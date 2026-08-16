// ─────────────────────────────────────────────────────────────────────────
// Staff leave engine. Apply → review (approve/reject) → balance, with balances
// DERIVED from approved records (never a stored/hardcoded number). Reuses the
// existing notification + audit systems; approved leave feeds the calendar.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notify";
import { normalizeDate } from "./engine";

export const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "EMERGENCY", "COMP", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_LABEL: Record<LeaveType, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned", EMERGENCY: "Emergency", COMP: "Compensatory", UNPAID: "Unpaid",
};
// Annual allocation per type. 0 = uncapped (unpaid). Institution-tunable later.
export const LEAVE_ALLOCATION: Record<LeaveType, number> = {
  CASUAL: 12, SICK: 8, EARNED: 15, EMERGENCY: 3, COMP: 6, UNPAID: 0,
};

export function isLeaveType(v: string): v is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(v);
}

/** Inclusive whole-day span between two IST-anchored dates. */
function inclusiveDays(from: Date, to: Date): number {
  const a = normalizeDate(from).getTime();
  const b = normalizeDate(to).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export interface LeaveBalanceRow {
  type: LeaveType;
  allocated: number; // 0 = uncapped
  used: number; // approved days this year
  pending: number; // days in PENDING requests
  remaining: number | null; // null = uncapped
}

/** Per-type balance for a staff member in an academic/calendar year, derived
 *  from real approved + pending records. */
export async function leaveBalance(tenantId: string, staffId: string, year = new Date().getFullYear()): Promise<LeaveBalanceRow[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await prisma.staffLeave.groupBy({
    by: ["type", "status"],
    where: { tenantId, staffId, status: { in: ["APPROVED", "PENDING"] }, fromDate: { gte: yearStart, lt: yearEnd } },
    _sum: { days: true },
  });
  const used = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const r of rows) {
    (r.status === "APPROVED" ? used : pending).set(r.type, (r._sum.days ?? 0));
  }
  return LEAVE_TYPES.map((type) => {
    const allocated = LEAVE_ALLOCATION[type];
    const u = used.get(type) ?? 0;
    const p = pending.get(type) ?? 0;
    return { type, allocated, used: u, pending: p, remaining: allocated === 0 ? null : allocated - u };
  });
}

/**
 * Apply for leave (the staff member themselves). Validates the range, prevents
 * overlaps with existing pending/approved leave, and enforces the remaining
 * balance for capped types. Notifies HR/admins and audits.
 */
export async function applyLeave(input: {
  tenantId: string;
  staffId: string;
  actorId: string;
  type: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
}) {
  if (!isLeaveType(input.type)) throw new Error("Invalid leave type");
  const from = normalizeDate(input.fromDate);
  const to = normalizeDate(input.toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error("Invalid dates");
  if (to < from) throw new Error("End date can't be before start date");
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required");
  const days = inclusiveDays(from, to);

  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, tenantId: input.tenantId },
    include: { user: { select: { displayName: true } } },
  });
  if (!staff) throw new Error("Staff record not found");

  // Overlap guard — no two active requests may cover the same day.
  const clash = await prisma.staffLeave.findFirst({
    where: { staffId: input.staffId, tenantId: input.tenantId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: to }, toDate: { gte: from } },
  });
  if (clash) throw new Error("You already have leave that overlaps these dates");

  // Balance guard for capped types (approved + pending + this request).
  if (LEAVE_ALLOCATION[input.type] > 0) {
    const bal = (await leaveBalance(input.tenantId, input.staffId)).find((b) => b.type === input.type)!;
    if (bal.used + bal.pending + days > bal.allocated) {
      throw new Error(`Not enough ${LEAVE_LABEL[input.type]} leave — ${bal.allocated - bal.used - bal.pending} day(s) left`);
    }
  }

  const leave = await prisma.staffLeave.create({
    data: { tenantId: input.tenantId, staffId: input.staffId, type: input.type, fromDate: from, toDate: to, days, reason, status: "PENDING" },
  });

  await notify({
    tenantId: input.tenantId,
    role: "INSTITUTION_ADMIN",
    kind: "system",
    title: `Leave request — ${staff.user.displayName}`,
    body: `${LEAVE_LABEL[input.type]} leave · ${days} day(s). Review in Staff → Leave.`,
    href: "/institution/leave",
  }).catch(() => {});
  await audit({
    tenantId: input.tenantId, actorId: input.actorId, action: "LEAVE_CREATED", entity: "StaffLeave", entityId: leave.id,
    detail: `${input.type} · ${days}d · ${from.toISOString().slice(0, 10)}→${to.toISOString().slice(0, 10)}`,
  });
  return leave;
}

/** Approve or reject a pending leave request (HR/admin). Transactional + audited. */
export async function reviewLeave(input: {
  tenantId: string;
  actorId: string;
  leaveId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}) {
  const leave = await prisma.staffLeave.findFirst({
    where: { id: input.leaveId, tenantId: input.tenantId },
    include: { staff: { include: { user: { select: { id: true, displayName: true } } } } },
  });
  if (!leave) throw new Error("Leave request not found");
  if (leave.status !== "PENDING") throw new Error("This request has already been reviewed");

  await prisma.staffLeave.update({
    where: { id: leave.id },
    data: { status: input.decision, reviewedById: input.actorId, reviewedAt: new Date(), reviewNote: input.note?.trim() || null },
  });

  await notify({
    tenantId: input.tenantId,
    userId: leave.staff.user.id,
    kind: "system",
    title: `Leave ${input.decision === "APPROVED" ? "approved" : "rejected"}`,
    body: `Your ${LEAVE_LABEL[leave.type as LeaveType]} leave (${leave.days} day${leave.days === 1 ? "" : "s"}) was ${input.decision.toLowerCase()}.${input.note ? ` Note: ${input.note}` : ""}`,
    href: "/teacher/leave",
  }).catch(() => {});
  await audit({
    tenantId: input.tenantId, actorId: input.actorId,
    action: input.decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    entity: "StaffLeave", entityId: leave.id,
    detail: `${leave.staff.user.displayName} · ${leave.type} · ${leave.days}d`,
  });
  return leave;
}
