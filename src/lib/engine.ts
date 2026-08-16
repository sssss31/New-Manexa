// Central orchestration layer — every mutation goes through here so that
// audit logs, automations, and cross-module side-effects stay consistent.
// The SAD calls out sagas via Temporal; this monolith fires the same
// choreography synchronously and records it.

import { prisma } from "./prisma";
import { ownedOrThrow, TenantForbiddenError } from "./tenancy/guard";
import { nextSequence } from "./sequence";
import { assignManexaId } from "./manexa-id";
import { postPaymentJournal } from "./accounting";
import { assertSeat, assertActiveSubscription } from "./billing";
import { audit } from "./audit";
import { publish } from "./automation";
import { hashPassword, provisionedPassword } from "./auth";
import { notify } from "./notify";

// Guard helper: every caller-supplied studentId must belong to the tenant.
// Throws TENANT_FORBIDDEN if any id is foreign — prevents cross-tenant writes
// through globally-unique upsert keys (Attendance, Mark, etc.).
async function assertStudentsOwned(tenantId: string, studentIds: string[]) {
  const unique = Array.from(new Set(studentIds));
  if (unique.length === 0) return;
  const owned = await prisma.student.count({ where: { id: { in: unique }, tenantId } });
  if (owned !== unique.length) throw new TenantForbiddenError();
}

const YEAR = 2026;

// ---- LEAD / ADMISSION ----

export async function createLead(input: {
  tenantId: string;
  actorId?: string;
  parentName: string;
  studentName: string;
  gradeInterest: string;
  phone: string;
  email?: string;
  source: string;
}) {
  const lead = await prisma.lead.create({
    data: {
      tenantId: input.tenantId,
      parentName: input.parentName,
      studentName: input.studentName,
      gradeInterest: input.gradeInterest,
      phone: input.phone,
      email: input.email,
      source: input.source,
      stage: "NEW",
      score: scoreLead(input.source, input.gradeInterest),
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "LEAD_CREATE",
    entity: "Lead",
    entityId: lead.id,
    detail: `${input.source} · ${input.studentName} · ${input.gradeInterest}`,
  });
  await publish({
    type: "lead.new",
    tenantId: input.tenantId,
    leadId: lead.id,
    parentName: input.parentName,
  });
  return lead;
}

export async function advanceLead(input: {
  tenantId: string;
  actorId?: string;
  leadId: string;
  toStage: string;
  note?: string;
}) {
  const stages = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "VISITED", "APPLICATION", "CONFIRMED", "LOST"];
  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, tenantId: input.tenantId } });
  if (!lead) throw new Error("Lead not found");
  if (!stages.includes(input.toStage)) throw new Error("Invalid stage");
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: input.toStage,
      lostReason: input.toStage === "LOST" ? input.note ?? "unspecified" : lead.lostReason,
    },
  });
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: "STAGE_CHANGE",
      detail: `${lead.stage} → ${input.toStage}${input.note ? ` — ${input.note}` : ""}`,
      actorId: input.actorId,
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "LEAD_ADVANCE",
    entity: "Lead",
    entityId: lead.id,
    detail: `${lead.stage} → ${input.toStage}`,
  });
  return updated;
}

function scoreLead(source: string, grade: string) {
  let s = 40;
  if (source === "REFERRAL") s += 25;
  if (source === "WEBSITE") s += 10;
  if (grade.match(/1|2|3/)) s += 15;
  return Math.min(100, s);
}

// ---- ADMISSION → STUDENT + PARENT + INITIAL INVOICE ----

export async function admitFromLead(input: {
  tenantId: string;
  actorId?: string;
  leadId: string;
  classId: string;
  sectionId: string;
  rollNo?: string;
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, tenantId: input.tenantId },
  });
  if (!lead) throw new Error("Lead not found");
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found");
  // Billing gate: block if the plan's student seats are full or the
  // subscription has lapsed past grace. Throws SeatLimitError / SubscriptionExpiredError.
  await assertSeat(input.tenantId, "students");
  // Tenant guard: the target class/section must belong to this tenant, else an
  // admin could park students inside another institution's class rosters.
  const cls = await prisma.class.findFirst({ where: { id: input.classId, tenantId: input.tenantId } });
  const section = await prisma.section.findFirst({ where: { id: input.sectionId, tenantId: input.tenantId } });
  if (!cls || !section) throw new Error("Class/section not found");

  const admissionNo = await nextAdmissionNo(input.tenantId);
  // Student email is keyed on the admission number so two students with the
  // same (or non-ASCII → empty-slug) name can never collide on User.email —
  // a collision here used to crash admission with a P2002.
  const admSlug = admissionNo.replace(/[^0-9a-z]+/gi, "-").toLowerCase();
  const parentEmail =
    lead.email ?? `${slug(lead.parentName) || `parent-${admSlug}`}@parent.${tenant.subdomain}.test`;
  const studentEmail = `${slug(lead.studentName) || "student"}.${admSlug}@student.${tenant.subdomain}.test`;
  // Random per-account password in production; the demo password only in demo mode.
  const pw = await hashPassword(provisionedPassword());

  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {},
    create: {
      email: parentEmail,
      phone: lead.phone,
      passwordHash: pw,
      displayName: lead.parentName,
      role: "PARENT",
      tenantId: input.tenantId,
    },
  });
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      passwordHash: pw,
      displayName: lead.studentName,
      role: "STUDENT",
      tenantId: input.tenantId,
    },
  });

  const parent =
    (await prisma.parent.findUnique({ where: { userId: parentUser.id } })) ??
    (await prisma.parent.create({
      data: {
        tenantId: input.tenantId,
        userId: parentUser.id,
        relation: "GUARDIAN",
      },
    }));

  const student = await prisma.student.create({
    data: {
      tenantId: input.tenantId,
      userId: studentUser.id,
      admissionNo,
      rollNo: input.rollNo ?? String(await nextRollNo(input.tenantId, input.sectionId)),
      classId: cls.id,
      sectionId: section.id,
      status: "ACTIVE",
    },
  });
  // Centralized, immutable public ID (e.g. DPS-S-001).
  const manexaId = await assignManexaId(prisma, {
    userId: studentUser.id,
    tenantId: input.tenantId,
    kind: "STUDENT",
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "MANEXA_ID_ASSIGN",
    entity: "User",
    entityId: studentUser.id,
    detail: `${manexaId} · ${lead.studentName}`,
  }).catch(() => {});
  await prisma.parentStudent.create({
    data: { parentId: parent.id, studentId: student.id, isPrimary: true },
  });

  // Fee invoice for current period
  const structure = await prisma.feeStructure.findFirst({
    where: { tenantId: input.tenantId, classId: cls.id },
  });
  if (structure) {
    await createInvoice({
      tenantId: input.tenantId,
      studentId: student.id,
      periodLabel: `Admission · ${monthLabel(new Date())}`,
      structureId: structure.id,
      actorId: input.actorId,
    });
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: "CONFIRMED" },
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "ADMIT_STUDENT",
    entity: "Student",
    entityId: student.id,
    detail: `${lead.studentName} → ${cls.name} ${section.name}`,
  });
  return { student, parent };
}

async function nextAdmissionNo(tenantId: string) {
  const seq = await nextSequence(tenantId, "admission", () =>
    prisma.student.count({ where: { tenantId } })
  );
  return `${YEAR}/${String(seq).padStart(4, "0")}`;
}
async function nextRollNo(tenantId: string, sectionId: string) {
  return nextSequence(tenantId, `roll:${sectionId}`, () =>
    prisma.student.count({ where: { sectionId } })
  );
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}
function monthLabel(d: Date) {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

// ---- ATTENDANCE ----

export async function markAttendance(input: {
  tenantId: string;
  actorId: string;
  entries: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"; reason?: string }[];
  date?: Date;
}) {
  const date = normalizeDate(input.date ?? new Date());
  // Tenant guard: reject the whole batch if ANY studentId is foreign. The
  // Attendance upsert key (studentId, date) is globally unique, so an
  // unvalidated id would let one tenant overwrite another tenant's rows.
  await assertStudentsOwned(input.tenantId, input.entries.map((e) => e.studentId));

  // One batched fetch for all absentees (was one deep query per absentee).
  const absentIds = input.entries.filter((e) => e.status === "ABSENT").map((e) => e.studentId);
  const absentees = absentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: absentIds }, tenantId: input.tenantId },
        include: { user: true, parents: { include: { parent: { include: { user: true } } } } },
      })
    : [];
  const byId = new Map(absentees.map((s) => [s.id, s]));

  for (const e of input.entries) {
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: e.studentId, date } },
      update: { status: e.status, markedBy: input.actorId, reason: e.reason },
      create: {
        tenantId: input.tenantId,
        studentId: e.studentId,
        date,
        status: e.status,
        markedBy: input.actorId,
        reason: e.reason,
      },
    });
    if (e.status === "ABSENT") {
      const student = byId.get(e.studentId);
      if (student) {
        const parentPhone = student.parents[0]?.parent.user.phone ?? undefined;
        const parentUserId = student.parents[0]?.parent.user.id;
        await publish({
          type: "attendance.absent",
          tenantId: input.tenantId,
          studentId: student.id,
          studentName: student.user.displayName,
          parentPhone,
        });
        if (parentUserId) {
          await notify({
            tenantId: input.tenantId,
            userId: parentUserId,
            kind: "attendance",
            title: `${student.user.displayName} marked absent`,
            body: "If this is unexpected, contact the class teacher or apply leave from the app.",
            href: "/parent/attendance",
          });
        }
      }
    }
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "ATTENDANCE_MARK",
    entity: "Attendance",
    detail: `${input.entries.length} entries for ${date.toISOString().slice(0, 10)}`,
  });
}

/**
 * Parse an <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm") as IST.
 * The control posts a bare local time with NO offset; on a UTC serverless
 * runtime `new Date(raw)` used to shift every schedule by +5:30 hours.
 * Returns null for malformed input (callers must reject, not store Invalid Date).
 */
export function parseLocalDT(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw?.trim() ?? "");
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeDate(d: Date) {
  // Attendance day-key anchored to IST (UTC+5:30) so a UTC serverless deploy
  // and local dev agree on "today". Server-local midnight would shift the key
  // per-host and (studentId, date) is a hard unique constraint.
  const IST_OFFSET_MIN = 330;
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

// ---- FEES ----

export async function createInvoice(input: {
  tenantId: string;
  studentId: string;
  periodLabel: string;
  structureId: string;
  actorId?: string;
  dueInDays?: number;
}) {
  // Tenant guards: fee structure AND student must both belong to this tenant.
  const structure = await prisma.feeStructure.findFirst({
    where: { id: input.structureId, tenantId: input.tenantId },
  });
  if (!structure) throw new Error("Fee structure not found");
  await ownedOrThrow(prisma.student, { id: input.studentId, tenantId: input.tenantId });
  const items: { head: string; amount: number }[] = [];
  const push = (h: string, a: number) => {
    if (a > 0) items.push({ head: h, amount: a });
  };
  push("Tuition", structure.tuition);
  push("Transport", structure.transport);
  push("Hostel", structure.hostel);
  push("Lab", structure.lab);
  push("Activity", structure.activity);
  push("Exam", structure.exam);
  push("Misc", structure.misc);
  const subtotal = items.reduce((s, x) => s + x.amount, 0);
  const number = await nextInvoiceNo(input.tenantId);
  const dueDate = new Date(Date.now() + (input.dueInDays ?? 10) * 86400000);
  const inv = await prisma.invoice.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      number,
      periodLabel: input.periodLabel,
      dueDate,
      subtotal,
      total: subtotal,
      status: "DUE",
      items: { create: items },
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "INVOICE_CREATE",
    entity: "Invoice",
    entityId: inv.id,
    detail: `${number} · ${input.periodLabel} · ₹${subtotal}`,
  });
  return inv;
}

async function nextInvoiceNo(tenantId: string) {
  const seq = await nextSequence(tenantId, "invoice", () =>
    prisma.invoice.count({ where: { tenantId } })
  );
  return `INV-${YEAR}-${String(seq).padStart(5, "0")}`;
}

export type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "CASH" | "CHEQUE" | "RAZORPAY" | "BANK_TRANSFER" | "OTHER";

/**
 * Record a fee payment — supports PARTIAL payments. `amount` defaults to the
 * full outstanding balance; a smaller amount leaves the invoice PARTIALLY_PAID
 * and the next payment settles the SAME invoice.
 *
 * Concurrency-safe: the invoice row is locked (SELECT … FOR UPDATE) so two
 * simultaneous payments on the same invoice serialise and can never overpay.
 * Payment creation, invoice-status update and the balanced ledger posting are
 * one atomic transaction — all commit together or roll back.
 */
export async function payInvoice(input: {
  tenantId: string;
  invoiceId: string;
  method: PaymentMethod;
  /** Amount to pay now (INR). Omit to pay the full outstanding balance. */
  amount?: number;
  actorId?: string;
  gatewayTxId?: string;
  reference?: string;
}) {
  const gatewayTxId = input.gatewayTxId ?? `pay_${Math.random().toString(36).slice(2, 12)}`;

  const result = await prisma.$transaction(async (tx) => {
    // Row-lock the invoice → concurrent payments on it serialise here.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Invoice" WHERE id = ${input.invoiceId} AND "tenantId" = ${input.tenantId} FOR UPDATE`;
    if (locked.length === 0) throw new Error("Invoice not found");

    const inv = await tx.invoice.findUniqueOrThrow({
      where: { id: input.invoiceId },
      include: {
        payments: { select: { amount: true } },
        student: { include: { parents: { include: { parent: { include: { user: true } } } } } },
      },
    });
    if (inv.status === "CANCELLED") throw new Error("This invoice has been cancelled");

    const paidSoFar = inv.payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = inv.total - paidSoFar;
    if (outstanding <= 0) throw new Error("This invoice has already been paid");

    const amount = input.amount != null ? Math.round(input.amount) : outstanding;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be positive");
    if (amount > outstanding) {
      throw new Error(`Amount ₹${amount.toLocaleString("en-IN")} exceeds the ₹${outstanding.toLocaleString("en-IN")} outstanding`);
    }

    const payment = await tx.payment.create({
      data: { invoiceId: inv.id, amount, method: input.method, reference: input.reference ?? gatewayTxId, gatewayTxId },
    });

    const newPaid = paidSoFar + amount;
    const fullyPaid = newPaid >= inv.total;
    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? new Date() : null },
    });

    // Balanced double-entry (Dr Cash/Bank, Cr Tuition Fees) for the ACTUAL
    // amount paid — atomic with the payment.
    await postPaymentJournal(
      { tenantId: input.tenantId, paymentId: payment.id, amount, method: input.method, invoiceNumber: inv.number, date: payment.paidAt, actorId: input.actorId },
      tx
    );

    return { inv, payment, amount, newPaid, fullyPaid, outstandingAfter: inv.total - newPaid };
  });

  // --- Side effects after the transaction commits ---
  const { inv, amount, fullyPaid, outstandingAfter } = result;
  if (fullyPaid) {
    await publish({ type: "fee.invoice.paid", tenantId: input.tenantId, invoiceId: inv.id, number: inv.number, amount: inv.total });
  }
  const parentUser = inv.student.parents[0]?.parent.user;
  if (parentUser) {
    await notify({
      tenantId: input.tenantId,
      userId: parentUser.id,
      kind: "fee",
      title: `Payment received — ₹${amount.toLocaleString("en-IN")}`,
      body: fullyPaid
        ? `Invoice ${inv.number} is fully paid. Receipt available in Fees & payments.`
        : `₹${amount.toLocaleString("en-IN")} received for invoice ${inv.number}. ₹${outstandingAfter.toLocaleString("en-IN")} still outstanding.`,
      href: "/parent/fees",
    });
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "INVOICE_PAY",
    entity: "Invoice",
    entityId: inv.id,
    detail: `${input.method} · ₹${amount} · ${fullyPaid ? "PAID" : "PARTIALLY_PAID"} · bal ₹${outstandingAfter} · ${gatewayTxId}`,
  });
  return { ...inv, amountPaid: amount, fullyPaid, outstanding: outstandingAfter };
}

// ---- LMS ----

export async function publishCourse(input: {
  tenantId: string;
  actorId?: string;
  courseId: string;
}) {
  // Tenant guard before mutating by id (prevents cross-tenant publish / IDOR).
  await ownedOrThrow(prisma.course, { id: input.courseId, tenantId: input.tenantId });
  await prisma.course.update({
    where: { id: input.courseId },
    data: { publishedAt: new Date() },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "COURSE_PUBLISH",
    entity: "Course",
    entityId: input.courseId,
  });
}

export async function submitAssignment(input: {
  tenantId: string;
  actorId?: string;
  assignmentId: string;
  studentId: string;
  content: string;
}) {
  // Tenant guard: the assignment must belong to this tenant (via its course) —
  // otherwise a student could inject submissions into another institution.
  await ownedOrThrow(prisma.assignment, {
    id: input.assignmentId,
    course: { tenantId: input.tenantId },
  });
  const sub = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId: input.assignmentId, studentId: input.studentId } },
    update: { content: input.content, submittedAt: new Date() },
    create: {
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      content: input.content,
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "ASSIGNMENT_SUBMIT",
    entity: "AssignmentSubmission",
    entityId: sub.id,
  });
  return sub;
}

export async function gradeSubmission(input: {
  tenantId: string;
  actorId?: string;
  submissionId: string;
  score: number;
  feedback?: string;
}) {
  // Tenant guard: submission has no direct tenantId — scope via its student.
  await ownedOrThrow(prisma.assignmentSubmission, { id: input.submissionId, student: { tenantId: input.tenantId } });
  const sub = await prisma.assignmentSubmission.update({
    where: { id: input.submissionId },
    data: { score: input.score, feedback: input.feedback },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "ASSIGNMENT_GRADE",
    entity: "AssignmentSubmission",
    entityId: sub.id,
    detail: `score=${input.score}`,
  });
  return sub;
}

// ---- EXAMS ----

export async function enterMarks(input: {
  tenantId: string;
  actorId?: string;
  examId: string;
  entries: { studentId: string; score: number; remark?: string }[];
}) {
  // Tenant guards: the exam AND every studentId must belong to this tenant.
  // Mark has no tenantId column and (examId, studentId) is globally unique, so
  // unvalidated ids would let a teacher rewrite another institution's marks.
  const exam = await ownedOrThrow<{ id: string; maxScore: number; status: string }>(
    prisma.exam,
    { id: input.examId, tenantId: input.tenantId },
    { select: { id: true, maxScore: true, status: true } }
  );
  // Status guard (§3/§17/§33): published marks are immutable here — corrections
  // go through the audited correction flow, not a silent re-entry. Cancelled
  // exams can't take marks.
  if (exam.status === "PUBLISHED") throw new Error("Results are published — edit via a correction request, not marks entry");
  if (exam.status === "CANCELLED") throw new Error("This exam is cancelled");

  await assertStudentsOwned(input.tenantId, input.entries.map((e) => e.studentId));

  // Score validation (§15): integer, 0 ≤ score ≤ maxScore. Reject the WHOLE
  // batch on any invalid row so the DB is never partially corrupted.
  for (const e of input.entries) {
    const s = Math.round(e.score);
    if (!Number.isFinite(s) || s < 0 || s > exam.maxScore) {
      throw new Error(`Invalid marks: ${e.score} — must be between 0 and ${exam.maxScore}`);
    }
  }

  // Transactional (§44): all marks + the status flip commit together or roll back.
  await prisma.$transaction([
    ...input.entries.map((e) =>
      prisma.mark.upsert({
        where: { examId_studentId: { examId: input.examId, studentId: e.studentId } },
        update: { score: Math.round(e.score), remark: e.remark },
        create: { examId: input.examId, studentId: e.studentId, score: Math.round(e.score), remark: e.remark },
      })
    ),
    // Only flip to EVALUATED when marks were actually entered — a blank form
    // submit must not change exam state.
    ...(input.entries.length > 0
      ? [prisma.exam.update({ where: { id: input.examId }, data: { status: "EVALUATED" } })]
      : []),
  ]);
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "MARKS_ENTER",
    entity: "Exam",
    entityId: input.examId,
    detail: `${input.entries.length} marks entered`,
  });
}

export async function publishExam(input: { tenantId: string; actorId?: string; examId: string }) {
  // Tenant guard before mutating by id (prevents cross-tenant publish / IDOR).
  const exam = await ownedOrThrow<{ id: string; title: string; status: string; class: { name: string }; subject: { name: string }; _count: { marks: number } }>(
    prisma.exam,
    { id: input.examId, tenantId: input.tenantId },
    { include: { subject: true, class: true, _count: { select: { marks: true } } } }
  );
  // Valid-transition guard (§3): only an evaluated exam with real marks can be
  // published; never a cancelled exam and never a silent re-publish.
  if (exam.status === "PUBLISHED") throw new Error("Results are already published");
  if (exam.status === "CANCELLED") throw new Error("A cancelled exam cannot be published");
  if (exam._count.marks === 0) throw new Error("Enter marks before publishing results");
  await prisma.exam.update({
    where: { id: exam.id },
    data: { status: "PUBLISHED" },
  });
  await publish({
    type: "exam.result.published",
    tenantId: input.tenantId,
    examId: exam.id,
    className: exam.class.name,
    subject: exam.subject.name,
  });
  await notify({
    tenantId: input.tenantId,
    role: "PARENT",
    kind: "exam",
    title: `Results published — ${exam.title}`,
    body: `${exam.class.name} · ${exam.subject.name}. View marks in the Results section.`,
    href: "/parent/results",
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "EXAM_PUBLISH",
    entity: "Exam",
    entityId: exam.id,
    detail: `${exam.title}`,
  });
}

// ---- NOTICES ----

export async function postNotice(input: {
  tenantId: string;
  actorId?: string;
  title: string;
  body: string;
  audience: "ALL" | "CLASS" | "PARENTS" | "STAFF";
  audienceScope?: string;
}) {
  const n = await prisma.notice.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      body: input.body,
      audience: input.audience,
      audienceScope: input.audienceScope,
      authorId: input.actorId,
    },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "NOTICE_POST",
    entity: "Notice",
    entityId: n.id,
    detail: input.title,
  });
  if (input.audience === "CLASS" && input.audienceScope) {
    // Class-scoped notice → notify ONLY that class's students (it used to
    // broadcast to every student in the tenant, ignoring audienceScope).
    const students = await prisma.student.findMany({
      where: { tenantId: input.tenantId, classId: input.audienceScope, status: "ACTIVE" },
      select: { userId: true },
    });
    for (const s of students) {
      await notify({
        tenantId: input.tenantId,
        userId: s.userId,
        kind: "notice",
        title: input.title,
        body: input.body.slice(0, 140),
      });
    }
  } else {
    const roleMap: Record<string, string | null> = { PARENTS: "PARENT", STAFF: "TEACHER", CLASS: "STUDENT", ALL: null };
    await notify({
      tenantId: input.tenantId,
      role: roleMap[input.audience] ?? null,
      kind: "notice",
      title: input.title,
      body: input.body.slice(0, 140),
    });
  }
  return n;
}

// ---- PAYROLL (light) ----

export async function runPayroll(input: { tenantId: string; actorId?: string; period: string }) {
  const staff = await prisma.staff.findMany({
    where: { tenantId: input.tenantId, status: "ACTIVE" },
  });
  // Compute the lines FIRST, then derive header totals from the very same
  // numbers — a separately-rounded header used to drift ₹1/employee from the
  // sum of its lines (reconciliation failure on the finance page).
  const lines = staff.map((s) => {
    const pf = Math.round(s.ctcMonthly * 0.06);
    const esi = Math.round(s.ctcMonthly * 0.015);
    const tds = Math.round(s.ctcMonthly * 0.045);
    return { staffId: s.id, gross: s.ctcMonthly, pf, esi, tds, net: s.ctcMonthly - pf - esi - tds };
  });
  const totalGross = lines.reduce((s, l) => s + l.gross, 0);
  const totalNet = lines.reduce((s, l) => s + l.net, 0);
  const run = await prisma.payrollRun.upsert({
    where: { tenantId_period: { tenantId: input.tenantId, period: input.period } },
    // Re-running a period rebuilds the lines below, so the header totals must
    // refresh too (they used to stay stale after a staff change).
    update: { totalGross, totalNet },
    create: {
      tenantId: input.tenantId,
      period: input.period,
      totalGross,
      totalNet,
      status: "DRAFT",
    },
  });
  await prisma.payrollLine.deleteMany({ where: { payrollRunId: run.id } });
  for (const l of lines) {
    await prisma.payrollLine.create({ data: { payrollRunId: run.id, ...l } });
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "PAYROLL_RUN",
    entity: "PayrollRun",
    entityId: run.id,
    detail: `${input.period} · ${staff.length} staff`,
  });
  return run;
}

export async function approvePayroll(input: { tenantId: string; actorId?: string; runId: string }) {
  // Tenant guard before mutating by id (same pattern as disbursePayroll).
  await ownedOrThrow(prisma.payrollRun, { id: input.runId, tenantId: input.tenantId });
  const run = await prisma.payrollRun.update({
    where: { id: input.runId },
    data: { status: "APPROVED" },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "PAYROLL_APPROVE",
    entity: "PayrollRun",
    entityId: run.id,
  });
}

export async function disbursePayroll(input: { tenantId: string; actorId?: string; runId: string }) {
  // Tenant guard before mutating by id (prevents cross-tenant disbursal / IDOR).
  await ownedOrThrow(prisma.payrollRun, { id: input.runId, tenantId: input.tenantId });
  const run = await prisma.payrollRun.update({
    where: { id: input.runId },
    data: { status: "DISBURSED" },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "PAYROLL_DISBURSE",
    entity: "PayrollRun",
    entityId: run.id,
  });
}

// ---- LIBRARY ----

export async function issueBook(input: {
  tenantId: string;
  actorId?: string;
  itemId: string;
  studentId: string;
  days?: number;
}) {
  const item = await prisma.libraryItem.findFirst({
    where: { id: input.itemId, tenantId: input.tenantId },
  });
  if (!item || item.available < 1) throw new Error("Book not available");
  // Tenant guard: the borrower must belong to this tenant too.
  await ownedOrThrow(prisma.student, { id: input.studentId, tenantId: input.tenantId });
  const dueAt = new Date(Date.now() + (input.days ?? 14) * 86400000);
  const loan = await prisma.libraryLoan.create({
    data: {
      itemId: item.id,
      studentId: input.studentId,
      dueAt,
    },
  });
  // Atomic decrement (read-modify-write raced under two simultaneous issues).
  await prisma.libraryItem.update({
    where: { id: item.id },
    data: { available: { decrement: 1 } },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "LIBRARY_ISSUE",
    entity: "LibraryLoan",
    entityId: loan.id,
  });
  return loan;
}

export async function returnBook(input: { tenantId: string; actorId?: string; loanId: string }) {
  // Tenant guard: loan has no direct tenantId — scope via its library item.
  const loan = await ownedOrThrow<{ id: string; dueAt: Date; itemId: string; returnedAt: Date | null }>(
    prisma.libraryLoan,
    { id: input.loanId, item: { tenantId: input.tenantId } }
  );
  // Idempotency: a loan can only be returned once — double-return used to
  // increment stock twice, minting phantom copies.
  if (loan.returnedAt) throw new Error("Book already returned");
  const now = new Date();
  const overdueDays = Math.max(0, Math.floor((now.getTime() - loan.dueAt.getTime()) / 86400000));
  const fine = overdueDays * 5;
  // Conditional claim (guards the concurrent double-return too).
  const claimed = await prisma.libraryLoan.updateMany({
    where: { id: loan.id, returnedAt: null },
    data: { returnedAt: now, fine },
  });
  if (claimed.count === 0) throw new Error("Book already returned");
  await prisma.libraryItem.update({
    where: { id: loan.itemId },
    data: { available: { increment: 1 } },
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "LIBRARY_RETURN",
    entity: "LibraryLoan",
    entityId: loan.id,
    detail: fine > 0 ? `fine=${fine}` : undefined,
  });
  return { fine };
}

// ---- USERS ----

export async function createUser(input: {
  tenantId?: string | null;
  actorId?: string;
  email: string;
  displayName: string;
  role: string;
  phone?: string;
  password?: string;
}) {
  // Billing gate for tenant-scoped users only (platform-level users have no
  // tenant and no subscription). Staff-type roles consume a staff seat.
  if (input.tenantId) {
    const STAFF_ROLES = new Set([
      "TEACHER", "HR", "LIBRARIAN", "TRANSPORT_MGR", "ACCOUNTANT", "PRINCIPAL", "STAFF",
    ]);
    if (STAFF_ROLES.has(input.role)) await assertSeat(input.tenantId, "staff");
    else await assertActiveSubscription(input.tenantId);
  }
  const passwordHash = await hashPassword(input.password ?? provisionedPassword());
  const u = await prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      phone: input.phone,
      passwordHash,
      tenantId: input.tenantId ?? null,
    },
  });
  // Tenant-scoped people get a public MANEXA ID (platform users have no
  // institution, so no code to build one from).
  let manexaId: string | undefined;
  if (input.tenantId && input.role !== "PARENT") {
    manexaId = await assignManexaId(prisma, { userId: u.id, tenantId: input.tenantId, role: input.role });
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "USER_CREATE",
    entity: "User",
    entityId: u.id,
    detail: `${input.role} · ${input.email}${manexaId ? ` · ${manexaId}` : ""}`,
  });
  return u;
}

// ---- WORKFORCE ONBOARDING / JOIN-REQUEST APPROVAL ----
// A self-service join creates a PENDING user (+ its Staff/Parent record) that
// cannot sign in until an institution admin approves it here. These are the
// approve/reject halves of that lifecycle — tenant-guarded, transactional,
// audited, and notified.

export async function approveJoinRequest(input: {
  tenantId: string;
  actorId: string;
  userId: string;
  department?: string;
  designation?: string;
}) {
  // Tenant guard: the target MUST be a PENDING user of THIS tenant.
  const user = await ownedOrThrow<{ id: string; role: string; email: string; displayName: string }>(
    prisma.user,
    { id: input.userId, tenantId: input.tenantId, status: "PENDING" }
  );

  // Seat gate for staff roles (a pending teacher shouldn't be activatable past
  // the plan's staff cap).
  const STAFF_ROLES = new Set(["TEACHER", "HR", "LIBRARIAN", "TRANSPORT_MGR", "ACCOUNTANT", "PRINCIPAL", "STAFF"]);
  if (STAFF_ROLES.has(user.role)) await assertSeat(input.tenantId, "staff");

  // Activate + (optionally) place them in a department/designation atomically.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    if (input.department || input.designation) {
      await tx.staff.updateMany({
        where: { userId: user.id, tenantId: input.tenantId },
        data: {
          ...(input.department ? { department: input.department } : {}),
          ...(input.designation ? { designation: input.designation } : {}),
        },
      });
    }
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "JOIN_APPROVE",
    entity: "User",
    entityId: user.id,
    detail: `${user.role} · ${user.email}${input.department ? ` · ${input.department}` : ""}`,
  });

  // Role permissions already apply via the tenant's RBAC matrix; the account is
  // now eligible for face enrolment. Tell them they can sign in.
  await notify({
    tenantId: input.tenantId,
    userId: user.id,
    kind: "system",
    title: "Your account is approved 🎉",
    body: "An admin approved your request to join. You can now sign in to MANEXA.",
    href: "/login",
  }).catch(() => {});

  return user;
}

export async function rejectJoinRequest(input: {
  tenantId: string;
  actorId: string;
  userId: string;
  reason: string;
}) {
  const user = await ownedOrThrow<{ id: string; role: string; email: string; displayName: string }>(
    prisma.user,
    { id: input.userId, tenantId: input.tenantId, status: "PENDING" }
  );

  // Audit the rejection (with reason) BEFORE removing the account.
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "JOIN_REJECT",
    entity: "User",
    entityId: user.id,
    detail: `${user.role} · ${user.email} · reason: ${input.reason}`,
  });

  // Remove the pending account + its role record so the email frees up and the
  // person can submit a fresh request later. No partial data left behind.
  await prisma.$transaction(async (tx) => {
    await tx.staff.deleteMany({ where: { userId: user.id, tenantId: input.tenantId } });
    await tx.parent.deleteMany({ where: { userId: user.id, tenantId: input.tenantId } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });

  return user;
}
