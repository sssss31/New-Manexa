// Face Attendance engine — the only module that touches encrypted embeddings.
// Every function is tenant-scoped, audited, and fails closed.

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { encryptEmbedding, decryptEmbedding } from "./crypto";
import { cosineSimilarity, gradeQuality, l2normalize, QUALITY, type Pose, type QualityMetrics } from "./descriptor";

/** Prisma unique-constraint violation (matches the pattern used in sequence.ts). */
function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}

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

  // Recognized → mark attendance. Duplicate integrity is enforced at the DB by
  // the @@unique([sessionId, studentId]) constraint — the read below is a fast
  // path, and the create is wrapped so a concurrent second frame that loses the
  // race surfaces as "already marked" (duplicate=true) instead of a 500. Never
  // rely on the read alone: two near-simultaneous frames can both miss `existing`.
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
    let rec: { id: string; recognizedAt: Date } | null = null;
    try {
      rec = await prisma.faceAttendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: best.entry.studentId,
          status,
          confidence,
          deviceInfo: input.deviceInfo,
        },
        select: { id: true, recognizedAt: true },
      });
    } catch (e) {
      // P2002 = unique violation → another concurrent frame already inserted the
      // row. Treat as a duplicate; do NOT create a second attendance record.
      if (isUniqueViolation(e)) {
        const winner = await prisma.faceAttendanceRecord.findUnique({
          where: { sessionId_studentId: { sessionId: session.id, studentId: best.entry.studentId } },
          select: { recognizedAt: true },
        });
        duplicate = true;
        recognizedAt = winner?.recognizedAt ?? recognizedAt;
      } else {
        throw e;
      }
    }
    if (rec) {
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

// ────────────────────────────────────────────────────────────────
// Staff / employee face attendance (session-less "office kiosk" mode).
// Matches a face against the tenant's STAFF gallery and records a daily
// StaffAttendance punch (first-in / last-out / worked minutes). Reuses the
// same quality + liveness (replay) gates and encrypted-embedding matching as
// student recognition — no new trust surface.
// ────────────────────────────────────────────────────────────────

// Single, configurable cosine-similarity gate for staff/self face matching.
// Overridable per-deployment via FACE_MATCH_THRESHOLD (0.30–0.99). Kept in one
// place so recognition thresholds are never scattered as magic numbers.
export const FACE_MATCH_THRESHOLD = (() => {
  const raw = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.62);
  if (!Number.isFinite(raw)) return 0.62;
  return Math.min(0.99, Math.max(0.3, raw));
})();
const STAFF_MATCH_THRESHOLD = FACE_MATCH_THRESHOLD; // cosine; office lighting is controlled
const STAFF_LATE_AFTER_MIN = 9 * 60 + 30; // 09:30 IST workday start

function istDayKey(d: Date): Date {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}
function istMinutesOfDay(d: Date): number {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

interface StaffGalleryEntry {
  staffId: string;
  name: string;
  employeeCode: string;
  department: string | null;
  vectors: number[][];
}

async function loadStaffGallery(tenantId: string): Promise<StaffGalleryEntry[]> {
  const profiles = await prisma.faceProfile.findMany({
    where: { tenantId, subjectType: "STAFF", status: "ACTIVE", staff: { status: "ACTIVE" } },
    include: { samples: { select: { embedding: true } }, staff: { include: { user: true } } },
  });
  return profiles
    .filter((p) => p.staff && p.samples.length > 0)
    .map((p) => ({
      staffId: p.staffId!,
      name: p.staff!.user.displayName,
      employeeCode: p.staff!.employeeCode,
      department: p.staff!.department,
      vectors: p.samples.map((s) => decryptEmbedding(s.embedding)),
    }));
}

export interface StaffRecognizeResult {
  decision: "RECOGNIZED" | "LOW_CONFIDENCE" | "UNKNOWN" | "SPOOF_REJECTED" | "QUALITY_REJECTED";
  confidence: number;
  latencyMs: number;
  staff?: { id: string; name: string; employeeCode: string; department: string | null };
  attendance?: { status: string; firstInAt: string; lastOutAt: string; workedMinutes: number; punch: "IN" | "OUT" };
}

export async function recognizeStaff(input: {
  tenantId: string;
  actorId?: string;
  descriptor: number[];
  quality: QualityMetrics;
  livenessScore: number;
  deviceInfo?: string;
}): Promise<StaffRecognizeResult> {
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);

  const verdict = gradeQuality(input.quality);
  if (!verdict.ok) return { decision: "QUALITY_REJECTED", confidence: 0, latencyMs: latency() };

  const vec = l2normalize(input.descriptor);
  if (!passesLiveness(`staff:${input.tenantId}`, vec, input.livenessScore)) {
    return { decision: "SPOOF_REJECTED", confidence: 0, latencyMs: latency() };
  }

  const gallery = await loadStaffGallery(input.tenantId);
  let best: { entry: StaffGalleryEntry; sim: number } | null = null;
  for (const entry of gallery) {
    for (const g of entry.vectors) {
      const sim = cosineSimilarity(vec, g);
      if (!best || sim > best.sim) best = { entry, sim };
    }
  }
  const confidence = best ? Math.round(Math.max(0, best.sim) * 100) : 0;
  if (!best || best.sim < STAFF_MATCH_THRESHOLD - 0.04) return { decision: "UNKNOWN", confidence, latencyMs: latency() };
  if (best.sim < STAFF_MATCH_THRESHOLD) return { decision: "LOW_CONFIDENCE", confidence, latencyMs: latency() };

  // Record / update today's rollup. First recognition = IN; later ones move
  // last-out and accumulate worked minutes.
  const now = new Date();
  const date = istDayKey(now);
  const existing = await prisma.staffAttendance.findUnique({
    where: { staffId_date: { staffId: best.entry.staffId, date } },
  });
  let row;
  let punch: "IN" | "OUT";
  if (!existing) {
    const status = istMinutesOfDay(now) > STAFF_LATE_AFTER_MIN ? "LATE" : "PRESENT";
    row = await prisma.staffAttendance.create({
      data: { tenantId: input.tenantId, staffId: best.entry.staffId, date, firstInAt: now, lastOutAt: now, status, method: "FACE" },
    });
    punch = "IN";
  } else {
    const worked = existing.firstInAt ? Math.max(0, Math.round((now.getTime() - existing.firstInAt.getTime()) / 60_000)) : 0;
    row = await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: { lastOutAt: now, workedMinutes: worked },
    });
    punch = "OUT";
  }

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "STAFF_ATTENDANCE_FACE",
    entity: "StaffAttendance",
    entityId: row.id,
    detail: `${best.entry.name} · ${punch} · ${confidence}%`,
  });

  return {
    decision: "RECOGNIZED",
    confidence,
    latencyMs: latency(),
    staff: { id: best.entry.staffId, name: best.entry.name, employeeCode: best.entry.employeeCode, department: best.entry.department },
    attendance: {
      status: row.status,
      firstInAt: (row.firstInAt ?? now).toISOString(),
      lastOutAt: (row.lastOutAt ?? now).toISOString(),
      workedMinutes: row.workedMinutes,
      punch,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Self check-in by face (teacher / staff marking THEIR OWN attendance).
//
// This is 1:1 VERIFICATION, not 1:N identification: the caller is already
// authenticated, so we compare the presented face against ONLY that person's
// own enrolled template. This is the correct security model here —
//   • a colleague's face can never punch you in (no cross-matching), and
//   • you can never be marked as someone else.
// It records the same StaffAttendance row the office kiosk uses (no duplicate
// system) and is idempotent per IST day via @@unique([staffId, date]).
// ────────────────────────────────────────────────────────────────

export interface SelfCheckInResult {
  // MARKED = first punch today; ALREADY_MARKED = idempotent no-op (still success).
  decision: "MARKED" | "ALREADY_MARKED" | "NO_MATCH" | "NOT_ENROLLED" | "QUALITY_REJECTED" | "SPOOF_REJECTED";
  confidence: number;
  latencyMs: number;
  attendance?: { status: string; checkInAt: string };
}

export async function selfCheckInByFace(input: {
  tenantId: string;
  actorId: string; // the caller's USER id (AuditLog.actorId FK → User.id)
  staffId: string; // the AUTHENTICATED caller's own staff record — never client-supplied
  name: string;
  descriptor: number[];
  quality: QualityMetrics;
  livenessScore: number;
  deviceInfo?: string;
}): Promise<SelfCheckInResult> {
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);

  // Gate 1: quality (server re-grade).
  const verdict = gradeQuality(input.quality);
  if (!verdict.ok) return { decision: "QUALITY_REJECTED", confidence: 0, latencyMs: latency() };

  const vec = l2normalize(input.descriptor);

  // Gate 2: anti-replay / liveness, keyed to this person.
  if (!passesLiveness(`self:${input.tenantId}:${input.staffId}`, vec, input.livenessScore)) {
    return { decision: "SPOOF_REJECTED", confidence: 0, latencyMs: latency() };
  }

  // Gate 3: verify against the caller's OWN enrolled samples only. Scoped by
  // tenant + staffId so no other institution's or colleague's template is loaded.
  const profile = await prisma.faceProfile.findFirst({
    where: { tenantId: input.tenantId, staffId: input.staffId, subjectType: "STAFF", status: "ACTIVE" },
    include: { samples: { select: { embedding: true } } },
  });
  if (!profile || profile.samples.length === 0) {
    return { decision: "NOT_ENROLLED", confidence: 0, latencyMs: latency() };
  }

  let bestSim = -1;
  for (const s of profile.samples) {
    const sim = cosineSimilarity(vec, decryptEmbedding(s.embedding));
    if (sim > bestSim) bestSim = sim;
  }
  const confidence = Math.round(Math.max(0, bestSim) * 100);
  if (bestSim < FACE_MATCH_THRESHOLD) {
    await audit({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "SELF_ATTENDANCE_FACE_FAIL",
      entity: "Staff",
      entityId: input.staffId,
      detail: `NO_MATCH conf=${confidence}`,
    });
    return { decision: "NO_MATCH", confidence, latencyMs: latency() };
  }

  // Verified → record today's punch (idempotent; DB unique is the real guard).
  const now = new Date();
  const date = istDayKey(now);
  const existing = await prisma.staffAttendance.findUnique({
    where: { staffId_date: { staffId: input.staffId, date } },
  });
  if (existing) {
    return {
      decision: "ALREADY_MARKED",
      confidence,
      latencyMs: latency(),
      attendance: { status: existing.status, checkInAt: (existing.firstInAt ?? now).toISOString() },
    };
  }

  const status = istMinutesOfDay(now) > STAFF_LATE_AFTER_MIN ? "LATE" : "PRESENT";
  let row: { status: string; firstInAt: Date | null };
  try {
    row = await prisma.staffAttendance.create({
      data: { tenantId: input.tenantId, staffId: input.staffId, date, firstInAt: now, lastOutAt: now, status, method: "FACE" },
      select: { status: true, firstInAt: true },
    });
  } catch (e) {
    // Lost a race with a concurrent tab → already marked, not an error.
    if (isUniqueViolation(e)) {
      const winner = await prisma.staffAttendance.findUnique({
        where: { staffId_date: { staffId: input.staffId, date } },
        select: { status: true, firstInAt: true },
      });
      return {
        decision: "ALREADY_MARKED",
        confidence,
        latencyMs: latency(),
        attendance: { status: winner?.status ?? status, checkInAt: (winner?.firstInAt ?? now).toISOString() },
      };
    }
    throw e;
  }

  // Best-effort: the attendance row is already committed, so a logging failure
  // must NOT turn a real check-in into a UI failure.
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "SELF_ATTENDANCE_FACE",
    entity: "StaffAttendance",
    entityId: input.staffId,
    detail: `${input.name} ${status} conf=${confidence}`,
  }).catch(() => {});

  return {
    decision: "MARKED",
    confidence,
    latencyMs: latency(),
    attendance: { status: row.status, checkInAt: (row.firstInAt ?? now).toISOString() },
  };
}
