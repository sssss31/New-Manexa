// ─────────────────────────────────────────────────────────────────────────
// Central calendar — the single source of truth for what happens on a date.
//
// It does NOT own its own event store: it AGGREGATES the real records already
// living in each module (Events/Holidays, Exams, Assignments, Fee due dates)
// into one tenant-scoped, RBAC-filtered, date-range-bounded feed. Every query
// is scoped by tenantId + an indexed date range, so a month view fetches only
// that month — never the whole institution.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "./prisma";

export type CalendarCategory =
  | "EVENT" | "HOLIDAY" | "MEETING" | "EXAM" | "ASSIGNMENT" | "FINANCE" | "LEAVE";

export interface CalendarItem {
  id: string;
  date: Date; // start
  end?: Date | null;
  title: string;
  category: CalendarCategory;
  detail?: string;
  href?: string;
  allDay?: boolean;
}

export const CATEGORY_META: Record<CalendarCategory, { label: string; tw: string }> = {
  EVENT: { label: "Event", tw: "bg-accent/15 text-accent border-accent/30" },
  HOLIDAY: { label: "Holiday", tw: "bg-error/15 text-error border-error/30" },
  MEETING: { label: "Meeting", tw: "bg-mint/15 text-mint border-mint/30" },
  EXAM: { label: "Exam", tw: "bg-warning/15 text-warning border-warning/30" },
  ASSIGNMENT: { label: "Assignment", tw: "bg-info/15 text-info border-info/30" },
  FINANCE: { label: "Fee / Finance", tw: "bg-success/15 text-success border-success/30" },
  LEAVE: { label: "Leave", tw: "bg-subtle/20 text-muted border-border" },
};

/** Which event audiences a role may see (admins/principals see everything). */
function audiencesForRole(role: string): string[] | "ALL" {
  if (role === "INSTITUTION_ADMIN" || role === "PRINCIPAL") return "ALL";
  if (role === "PARENT") return ["ALL", "PARENTS"];
  if (role === "STUDENT") return ["ALL", "STUDENTS"];
  return ["ALL", "STAFF"]; // teachers, accountants, HR, etc.
}

const eventCategory = (c: string): CalendarCategory =>
  c === "HOLIDAY" ? "HOLIDAY" : c === "MEETING" ? "MEETING" : "EVENT";

/**
 * Aggregate every calendar-relevant record for a tenant within [from, to],
 * filtered to what `role`/`userId` is allowed to see.
 */
export async function getCalendarItems(input: {
  tenantId: string;
  from: Date;
  to: Date;
  role: string;
  userId: string;
}): Promise<CalendarItem[]> {
  const { tenantId, from, to, role, userId } = input;
  const items: CalendarItem[] = [];
  const isStaff = ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT", "HR"].includes(role);
  const isFinance = ["INSTITUTION_ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(role);

  // Resolve the viewer's scope (their class / children) for row-level filtering.
  let studentClassIds: string[] = [];
  let childStudentIds: string[] = [];
  if (role === "STUDENT") {
    const s = await prisma.student.findFirst({ where: { userId, tenantId }, select: { classId: true } });
    if (s) studentClassIds = [s.classId];
  } else if (role === "PARENT") {
    const p = await prisma.parent.findUnique({ where: { userId }, select: { children: { select: { student: { select: { id: true, classId: true } } } } } });
    childStudentIds = p?.children.map((c) => c.student.id) ?? [];
    studentClassIds = [...new Set(p?.children.map((c) => c.student.classId) ?? [])];
  }

  // --- Events / Holidays / Meetings (audience-scoped) ---
  const aud = audiencesForRole(role);
  const events = await prisma.event.findMany({
    where: { tenantId, startsAt: { gte: from, lte: to }, ...(aud === "ALL" ? {} : { audience: { in: aud } }) },
    orderBy: { startsAt: "asc" },
  });
  for (const e of events) {
    items.push({
      id: e.id, date: e.startsAt, end: e.endsAt, title: e.title, category: eventCategory(e.category),
      detail: e.venue ?? undefined, href: role === "INSTITUTION_ADMIN" || role === "PRINCIPAL" ? "/institution/events" : undefined,
    });
  }

  // --- Exams (class-scoped for student/parent, all for staff) ---
  const examWhere: any = { tenantId, scheduledAt: { gte: from, lte: to } };
  if (role === "STUDENT" || role === "PARENT") {
    if (studentClassIds.length === 0) examWhere.id = "__none__"; // no scope → nothing
    else examWhere.classId = { in: studentClassIds };
  }
  const exams = await prisma.exam.findMany({
    where: examWhere, include: { subject: { select: { name: true } }, class: { select: { name: true } } }, orderBy: { scheduledAt: "asc" },
  });
  for (const x of exams) {
    items.push({
      id: x.id, date: x.scheduledAt, title: `${x.subject.name} exam`, category: "EXAM",
      detail: `${x.class.name} · ${x.status.toLowerCase()}`,
    });
  }

  // --- Assignments due (teachers: own courses; admins: all) ---
  if (isStaff && role !== "ACCOUNTANT" && role !== "HR") {
    const assignments = await prisma.assignment.findMany({
      where: {
        dueAt: { gte: from, lte: to },
        course: { tenantId, ...(role === "TEACHER" ? { teacherId: userId } : {}) },
      },
      include: { course: { select: { subject: { select: { name: true } } } } },
      orderBy: { dueAt: "asc" },
      take: 200,
    });
    for (const as of assignments) {
      items.push({ id: as.id, date: as.dueAt, title: `${as.title} due`, category: "ASSIGNMENT", detail: as.course.subject.name });
    }
  }

  // --- Fee due dates (finance roles: aggregated; parent: their child's) ---
  if (isFinance) {
    const grouped = await prisma.invoice.groupBy({
      by: ["dueDate"],
      where: { tenantId, dueDate: { gte: from, lte: to }, status: { in: ["DUE", "PARTIALLY_PAID", "OVERDUE"] } },
      _count: true,
      _sum: { total: true },
    });
    for (const g of grouped) {
      items.push({
        id: `fees-${g.dueDate.toISOString()}`, date: g.dueDate,
        title: `${g._count} fee${g._count === 1 ? "" : "s"} due`, category: "FINANCE",
        detail: g._sum.total ? `₹${g._sum.total.toLocaleString("en-IN")}` : undefined,
        href: "/accounts/defaulters", allDay: true,
      });
    }
  } else if (role === "PARENT" && childStudentIds.length > 0) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, studentId: { in: childStudentIds }, dueDate: { gte: from, lte: to }, status: { in: ["DUE", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { student: { select: { user: { select: { displayName: true } } } } },
      orderBy: { dueDate: "asc" },
    });
    for (const inv of invoices) {
      items.push({
        id: inv.id, date: inv.dueDate, title: `Fee due — ${inv.periodLabel}`, category: "FINANCE",
        detail: `${inv.student.user.displayName} · ₹${inv.total.toLocaleString("en-IN")}`,
        href: "/parent/fees", allDay: true,
      });
    }
  }

  // --- Approved staff leave (§17) ---
  // Staff see their own; admins/principals see all. Others don't see staff leave.
  if (role === "TEACHER" || role === "HR" || role === "ACCOUNTANT") {
    const self = await prisma.staff.findFirst({ where: { userId, tenantId }, select: { id: true } });
    if (self) {
      const leaves = await prisma.staffLeave.findMany({
        where: { tenantId, staffId: self.id, status: "APPROVED", fromDate: { lte: to }, toDate: { gte: from } },
      });
      for (const l of leaves) {
        items.push({ id: l.id, date: l.fromDate, end: l.toDate, title: `${l.type} leave`, category: "LEAVE", detail: `${l.days} day${l.days === 1 ? "" : "s"}`, allDay: true });
      }
    }
  } else if (role === "INSTITUTION_ADMIN" || role === "PRINCIPAL") {
    const leaves = await prisma.staffLeave.findMany({
      where: { tenantId, status: "APPROVED", fromDate: { lte: to }, toDate: { gte: from } },
      include: { staff: { include: { user: { select: { displayName: true } } } } },
      take: 200,
    });
    for (const l of leaves) {
      items.push({ id: l.id, date: l.fromDate, end: l.toDate, title: `${l.staff.user.displayName} — ${l.type} leave`, category: "LEAVE", detail: `${l.days}d`, href: "/institution/leave", allDay: true });
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface CalendarViewItem {
  id: string;
  dayKey: string; // YYYY-MM-DD in IST
  timeLabel: string;
  title: string;
  category: CalendarCategory;
  detail?: string;
  href?: string;
}

const IST = "Asia/Kolkata";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit" });

/** IST day-key for "today" — the shared "current date" the whole app anchors to. */
export function istToday(): string {
  return dayFmt.format(new Date());
}

/** Shape items for the client calendar: IST day-key + time label (no client TZ drift). */
export function shapeForView(items: CalendarItem[]): CalendarViewItem[] {
  return items.map((i) => ({
    id: i.id,
    dayKey: dayFmt.format(i.date),
    timeLabel: i.allDay ? "All day" : timeFmt.format(i.date),
    title: i.title,
    category: i.category,
    detail: i.detail,
    href: i.href,
  }));
}

/** First/last instant of the calendar grid covering a YYYY-MM month (6-week grid). */
export function monthRange(month: string): { from: Date; to: Date; year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  const year = y;
  const monthIndex = m - 1;
  // Pad to full weeks (Sun-first) so the grid's leading/trailing days are covered.
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = first.getUTCDay();
  const from = new Date(Date.UTC(year, monthIndex, 1 - startPad));
  const to = new Date(Date.UTC(year, monthIndex + 1, 7)); // generous tail
  return { from, to, year, monthIndex };
}
