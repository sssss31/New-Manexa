// Central orchestration layer — every mutation goes through here so that
// audit logs, automations, and cross-module side-effects stay consistent.
// The SAD calls out sagas via Temporal; this monolith fires the same
// choreography synchronously and records it.

import { prisma } from "./prisma";
import { ownedOrThrow, TenantForbiddenError } from "./tenancy/guard";
import { nextSequence } from "./sequence";
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

export async function payInvoice(input: {
  tenantId: string;
  invoiceId: string;
  method: "UPI" | "CARD" | "NETBANKING" | "CASH" | "CHEQUE";
  actorId?: string;
}) {
  const inv = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    include: { student: { include: { parents: { include: { parent: { include: { user: true } } } } } } },
  });
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "PAID") throw new Error("Already paid");
  const gatewayTxId = `pay_${Math.random().toString(36).slice(2, 12)}`;
  // Atomic claim BEFORE recording the payment: a concurrent double-submit
  // (double-click / retry) loses this conditional update and throws, instead
  // of creating a second Payment row for the same invoice (TOCTOU).
  const claimed = await prisma.invoice.updateMany({
    where: { id: inv.id, tenantId: input.tenantId, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claimed.count === 0) throw new Error("Already paid");
  await prisma.payment.create({
    data: {
      invoiceId: inv.id,
      amount: inv.total,
      method: input.method,
      reference: gatewayTxId,
      gatewayTxId,
    },
  });
  const parentUser = inv.student.parents[0]?.parent.user;
  await publish({
    type: "fee.invoice.paid",
    tenantId: input.tenantId,
    invoiceId: inv.id,
    number: inv.number,
    amount: inv.total,
  });
  if (parentUser) {
    await notify({
      tenantId: input.tenantId,
      userId: parentUser.id,
      kind: "fee",
      title: `Payment received — ₹${inv.total.toLocaleString("en-IN")}`,
      body: `Invoice ${inv.number} is settled. Receipt available in Fees & payments.`,
      href: "/parent/fees",
    });
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "INVOICE_PAY",
    entity: "Invoice",
    entityId: inv.id,
    detail: `${input.method} · ₹${inv.total} · ${gatewayTxId}`,
  });
  return inv;
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
  await ownedOrThrow(prisma.exam, { id: input.examId, tenantId: input.tenantId });
  await assertStudentsOwned(input.tenantId, input.entries.map((e) => e.studentId));
  for (const e of input.entries) {
    await prisma.mark.upsert({
      where: { examId_studentId: { examId: input.examId, studentId: e.studentId } },
      update: { score: e.score, remark: e.remark },
      create: {
        examId: input.examId,
        studentId: e.studentId,
        score: e.score,
        remark: e.remark,
      },
    });
  }
  // Only flip to EVALUATED when marks were actually entered — a blank form
  // submit must not change exam state.
  if (input.entries.length > 0) {
    await prisma.exam.update({ where: { id: input.examId }, data: { status: "EVALUATED" } });
  }
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
  const exam = await ownedOrThrow<{ id: string; title: string; class: { name: string }; subject: { name: string } }>(
    prisma.exam,
    { id: input.examId, tenantId: input.tenantId },
    { include: { subject: true, class: true } }
  );
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
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "USER_CREATE",
    entity: "User",
    entityId: u.id,
    detail: `${input.role} · ${input.email}`,
  });
  return u;
}
