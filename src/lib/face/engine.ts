// Face Attendance engine — the only module that touches encrypted embeddings.
// Every function is tenant-scoped, audited, and fails closed.

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { encryptEmbedding, decryptEmbedding } from "./crypto";
import { cosineSimilarity, gradeQuality, l2normalize, QUALITY, type Pose, type QualityMetrics } from "./descriptor";

// ---------- Server-side liveness / anti-replay ----------
// The client-reported `livenessScore` is ADVISORY ONLY — a caller could POST
// `livenessScore: 100` with a captured descriptor to bypass a client-trusted
// gate. Server-side we enforce:
//   1. Replay detection — an identical descriptor re-submitted within a short
//      window is a captured-vector replay → rejected. (Live faces vary frame
//      to frame; byte-identical vectors do not recur naturally.)
//   2. Quality re-grade (already done downstream).
// True passive photo/screen liveness needs a real model — pluggable via
// FACE_LIVENESS_PROVIDER (unset = "basic": replay + quality + advisory score).
const LIVENESS_ADVISORY_MIN = Number(process.env.FACE_LIVENESS_MIN ?? 35);
const REPLAY_WINDOW_MS = 8000;
const seenDescriptors = new Map<string, number>(); // fingerprint -> lastSeen ms

function descriptorFingerprint(sessionId: string, vec: number[]): string {
  // Quantize the leading dims finely so only near-identical (replayed) vectors
  // collide; genuine live frames differ enough to miss.
  let fp = sessionId + "|";
  const n = Math.min(48, vec.length);
  for (let i = 0; i < n; i++) fp += Math.round(vec[i] * 1000) + ",";
  return fp;
}

/** True if this looks live; false = spoof/replay. Prunes its own cache. */
function passesLiveness(sessionId: string, vec: number[], clientScore: number): boolean {
  const now = Date.now();
  // Advisory: an honestly-low self-reported score is still respected.
  if (clientScore < LIVENESS_ADVISORY_MIN) return false;
  // Prune stale fingerprints (bounded cleanup).
  if (seenDescriptors.size > 5000) {
    for (const [k, t] of seenDescriptors) if (now - t > REPLAY_WINDOW_MS) seenDescriptors.delete(k);
  }
  const fp = descriptorFingerprint(sessionId, vec);
  const last = seenDescriptors.get(fp);
  seenDescriptors.set(fp, now);
  if (last !== undefined && now - last < REPLAY_WINDOW_MS) return false; // replay
  return true;
}

// ---------- Enrollment ----------

export async function enrollSample(input: {
  tenantId: string;
  actorId: string;
  subjectType: "STUDENT" | "STAFF";
  subjectId: string; // studentId or staffId
  pose: Pose;
  descriptor: number[];
  quality: QualityMetrics;
}) {
  // Tenant guard FIRST (authz before validation): the subject must exist IN
  // THIS TENANT. FaceProfile's studentId/staffId are globally unique, so an
  // unvalidated foreign id would bind a biometric template across tenants AND
  // permanently block the real tenant from ever enrolling that subject.
  const subjectOk =
    input.subjectType === "STUDENT"
      ? await prisma.student.findFirst({ where: { id: input.subjectId, tenantId: input.tenantId }, select: { id: true } })
      : await prisma.staff.findFirst({ where: { id: input.subjectId, tenantId: input.tenantId }, select: { id: true } });
  if (!subjectOk) {
    const err = new Error("Subject not found in this institution");
    (err as any).code = "SUBJECT_FORBIDDEN";
    throw err;
  }

  // Server-side re-validation — never trust the client's own quality claim.
  const verdict = gradeQuality(input.quality);
  if (!verdict.ok) {
    const err = new Error(`Sample rejected: ${verdict.reasons.join(", ")}`);
    (err as any).code = "QUALITY_REJECTED";
    throw err;
  }
  if (input.descriptor.length < 64) throw new Error("Descriptor too small");

  const vec = l2normalize(input.descriptor);

  // Upsert the profile (one per subject), bumping version on re-enrolment.
  const where =
    input.subjectType === "STUDENT" ? { studentId: input.subjectId } : { staffId: input.subjectId };
  let profile = await prisma.faceProfile.findFirst({ where: { tenantId: input.tenantId, ...where } });
  if (!profile) {
    profile = await prisma.faceProfile.create({
      data: { tenantId: input.tenantId, subjectType: input.subjectType, ...where },
    });
  } else {
    await prisma.faceProfile.update({ where: { id: profile.id }, data: { version: { increment: 1 } } });
  }

  // Replace any prior sample for this pose (keeps enrolment idempotent).
  await prisma.faceSample.deleteMany({ where: { profileId: profile.id, pose: input.pose } });
  await prisma.faceSample.create({
    data: {
      profileId: profile.id,
      pose: input.pose,
      dim: vec.length,
      embedding: encryptEmbedding(vec),
      quality: verdict.score,
      brightness: Math.round(input.quality.brightness),
      sharpness: Math.round(input.quality.sharpness),
      version: profile.version,
    },
  });

  // Roll up profile stats.
  const samples = await prisma.faceSample.findMany({ where: { profileId: profile.id }, select: { quality: true } });
  const avg = samples.length ? Math.round(samples.reduce((s, x) => s + x.quality, 0) / samples.length) : 0;
  await prisma.faceProfile.update({
    where: { id: profile.id },
    data: { sampleCount: samples.length, avgQuality: avg },
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "FACE_ENROLL",
    entity: "FaceProfile",
    entityId: profile.id,
    detail: `${input.subjectType} ${input.pose} q=${verdict.score}`,
  });

  return { profileId: profile.id, pose: input.pose, quality: verdict.score, sampleCount: samples.length };
}

export async function deleteProfile(input: { tenantId: string; actorId: string; profileId: string }) {
  const profile = await prisma.faceProfile.findFirst({ where: { id: input.profileId, tenantId: input.tenantId } });
  if (!profile) throw new Error("Profile not found");
  await prisma.faceProfile.delete({ where: { id: profile.id } }); // cascades samples
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "FACE_DELETE",
    entity: "FaceProfile",
    entityId: profile.id,
  });
}

// ---------- Gallery (in-memory match set) ----------
// Scoped to a class/section so the candidate set is ~40-200 vectors — fast in JS.
// At 100k students the whole-tenant gallery moves to pgvector/FAISS; this
// function is the only thing that changes.

interface GalleryEntry {
  studentId: string;
  name: string;
  className: string;
  rollNo: string | null;
  vectors: number[][];
}

async function loadGallery(tenantId: string, classId: string, sectionId: string): Promise<GalleryEntry[]> {
  const profiles = await prisma.faceProfile.findMany({
    where: {
      tenantId,
      subjectType: "STUDENT",
      status: "ACTIVE",
      student: { classId, sectionId, status: "ACTIVE", deletedAt: null },
    },
    include: {
      samples: { select: { embedding: true } },
      student: { include: { user: true, class: true, section: true } },
    },
  });
  return profiles
    .filter((p) => p.student && p.samples.length > 0)
    .map((p) => ({
      studentId: p.studentId!,
      name: p.student!.user.displayName,
      className: `${p.student!.class.name} ${p.student!.section.name}`,
      rollNo: p.student!.rollNo,
      vectors: p.samples.map((s) => decryptEmbedding(s.embedding)),
    }));
}

// ---------- Recognition ----------

export interface RecognizeResult {
  decision: "RECOGNIZED" | "LOW_CONFIDENCE" | "UNKNOWN" | "SPOOF_REJECTED" | "QUALITY_REJECTED";
  confidence: number; // 0-100
  latencyMs: number;
  student?: { id: string; name: string; className: string; rollNo: string | null };
  attendance?: { status: "PRESENT" | "LATE"; recognizedAt: string; duplicate: boolean };
}

export async function recognize(input: {
  tenantId: string;
  sessionId: string;
  descriptor: number[];
  quality: QualityMetrics;
  livenessScore: number; // 0-100 from client motion/blink analysis
  deviceInfo?: string;
}): Promise<RecognizeResult> {
  const started = performance.now();
  const session = await prisma.faceAttendanceSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId, status: "OPEN" },
  });
  if (!session) throw new Error("Session not open");

  const finish = async (
    decision: RecognizeResult["decision"],
    confidence: number,
    matchedStudentId?: string
  ): Promise<RecognizeResult> => {
    const latencyMs = Math.round(performance.now() - started);
    await prisma.recognitionLog.create({
      data: {
        tenantId: input.tenantId,
        sessionId: session.id,
        matchedStudentId,
        decision,
        confidence,
        latencyMs,
        livenessScore: Math.round(input.livenessScore),
      },
    });
    return { decision, confidence, latencyMs };
  };

  // Gate 1: quality (server re-grade — never trust the client's own claim).
  const verdict = gradeQuality(input.quality);
  if (!verdict.ok) return finish("QUALITY_REJECTED", 0);

  const vec = l2normalize(input.descriptor);

  // Gate 2: anti-spoofing / liveness — SERVER-side (replay detection + advisory
  // client score). The client score alone can no longer wave a spoof through.
  if (!passesLiveness(session.id, vec, input.livenessScore)) {
    return finish("SPOOF_REJECTED", 0);
  }

  // Gate 3: match against the section gallery.
  const gallery = await loadGallery(input.tenantId, session.classId, session.sectionId);
  let best: { entry: GalleryEntry; sim: number } | null = null;
  for (const entry of gallery) {
    for (const g of entry.vectors) {
      const sim = cosineSimilarity(vec, g);
      if (!best || sim > best.sim) best = { entry, sim };
    }
  }

  const threshold = session.threshold / 100;
  const margin = 0.04; // low-confidence band just under threshold
  const confidence = best ? Math.round(Math.max(0, best.sim) * 100) : 0;

  if (!best || best.sim < threshold - margin) {
    // Unknown — persist an encrypted descriptor for later match/register.
    await prisma.unknownFace.create({
      data: {
        tenantId: input.tenantId,
        sessionId: session.id,
        embedding: encryptEmbedding(vec),
        dim: vec.length,
        bestScore: confidence,
      },
    });
    return finish("UNKNOWN", confidence);
  }
  if (best.sim < threshold) return finish("LOW_CONFIDENCE", confidence, best.entry.studentId);

  // Recognized → mark attendance (dedupe by unique [session, student]).
  const late = minutesSince(session.startedAt) > session.lateAfterMin;
  const status = late ? "LATE" : "PRESENT";
  let duplicate = false;
  const existing = await prisma.faceAttendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId: best.entry.studentId } },
  });
  let recognizedAt = new Date();
  if (existing) {
    duplicate = true;
    recognizedAt = existing.recognizedAt;
  } else {
    const rec = await prisma.faceAttendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: best.entry.studentId,
        status,
        confidence,
        deviceInfo: input.deviceInfo,
      },
    });
    recognizedAt = rec.recognizedAt;
    // Mirror into the classic Attendance table so the rest of MANEXA (parent
    // portal, AI risk, reports) sees face marks natively.
    await mirrorToAttendance(input.tenantId, best.entry.studentId, status, session.teacherId);
    await notifyParent(input.tenantId, best.entry.studentId, best.entry.name, status);
    await audit({
      tenantId: input.tenantId,
      actorId: session.teacherId ?? undefined,
      action: "FACE_ATTENDANCE_MARK",
      entity: "FaceAttendanceRecord",
      entityId: rec.id,
      detail: `${best.entry.name} ${status} conf=${confidence}`,
    });
  }

  const out = await finish("RECOGNIZED", confidence, best.entry.studentId);
  return {
    ...out,
    student: {
      id: best.entry.studentId,
      name: best.entry.name,
      className: best.entry.className,
      rollNo: best.entry.rollNo,
    },
    attendance: { status, recognizedAt: recognizedAt.toISOString(), duplicate },
  };
}

async function mirrorToAttendance(tenantId: string, studentId: string, status: string, markedBy?: string | null) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  await prisma.attendance.upsert({
    where: { studentId_date: { studentId, date } },
    update: { status: status === "LATE" ? "LATE" : "PRESENT", markedBy: markedBy ?? "face-engine" },
    create: {
      tenantId,
      studentId,
      date,
      status: status === "LATE" ? "LATE" : "PRESENT",
      markedBy: markedBy ?? "face-engine",
    },
  });
}

async function notifyParent(tenantId: string, studentId: string, studentName: string, status: string) {
  const link = await prisma.parentStudent.findFirst({
    where: { studentId },
    include: { parent: { include: { user: true } } },
  });
  if (!link) return;
  await notify({
    tenantId,
    userId: link.parent.user.id,
    kind: "attendance",
    title: `${studentName} marked ${status.toLowerCase()}`,
    body:
      status === "LATE"
        ? "Face check-in recorded after the late cutoff."
        : "Face check-in recorded on campus.",
    href: "/parent/attendance",
  });
}

function minutesSince(d: Date) {
  return (Date.now() - d.getTime()) / 60000;
}

// ---------- Sessions ----------

export async function startSession(input: {
  tenantId: string;
  actorId: string;
  classId: string;
  sectionId: string;
  subjectId?: string;
  period?: number;
  deviceId?: string;
  threshold?: number;
}) {
  // Reuse any already-open session for the same class/section to avoid dupes.
  const open = await prisma.faceAttendanceSession.findFirst({
    where: { tenantId: input.tenantId, classId: input.classId, sectionId: input.sectionId, status: "OPEN" },
  });
  if (open) return open;

  const session = await prisma.faceAttendanceSession.create({
    data: {
      tenantId: input.tenantId,
      classId: input.classId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
      period: input.period,
      teacherId: input.actorId,
      deviceId: input.deviceId,
      threshold: input.threshold ?? QUALITY_DEFAULT_THRESHOLD,
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "FACE_SESSION_START",
    entity: "FaceAttendanceSession",
    entityId: session.id,
  });
  return session;
}

export const QUALITY_DEFAULT_THRESHOLD = 88;

export async function stopSession(input: { tenantId: string; actorId: string; sessionId: string }) {
  // Defense-in-depth tenant guard at the engine boundary (the route also
  // checks ownership, but the engine must not trust its callers).
  const owned = await prisma.faceAttendanceSession.findFirst({
    where: { id: input.sessionId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!owned) throw new Error("Session not found");
  const session = await prisma.faceAttendanceSession.update({
    where: { id: input.sessionId },
    data: { status: "CLOSED", endedAt: new Date() },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "FACE_SESSION_STOP",
    entity: "FaceAttendanceSession",
    entityId: session.id,
  });
  return session;
}

export async function resolveUnknown(input: {
  tenantId: string;
  actorId: string;
  unknownId: string;
  resolution: "IGNORED" | "REGISTERED" | "RETRIED";
}) {
  const u = await prisma.unknownFace.findFirst({ where: { id: input.unknownId, tenantId: input.tenantId } });
  if (!u) throw new Error("Not found");
  await prisma.unknownFace.update({
    where: { id: u.id },
    data: { resolved: true, resolution: input.resolution },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "FACE_UNKNOWN_RESOLVE",
    entity: "UnknownFace",
    entityId: u.id,
    detail: input.resolution,
  });
}
