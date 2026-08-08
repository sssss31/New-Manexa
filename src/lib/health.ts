// Institution Health Score — a single composite, computed live from real data
// (never a hardcoded number). Four weighted dimensions:
//   • Attendance     — student present-rate over the last 30 days
//   • Fee collection — payments received vs total invoiced
//   • Academics      — average assessment score across recorded marks
//   • Operations     — overdue invoices, pending approvals, staffing ratio
// Dimensions with no data yet score `null` and are excluded from the weighted
// overall (so a brand-new tenant isn't unfairly penalised). Suggestions are
// derived from the actual weak spots — this is the dashboard's "what needs my
// attention" / AI-recommendations surface, grounded in the tenant's own numbers.
import { prisma } from "./prisma";
import { inr } from "./format";

const DAY = 86_400_000;

export type HealthBand = "excellent" | "good" | "fair" | "attention";
export type HealthDimension = {
  key: "attendance" | "finance" | "academics" | "operations";
  label: string;
  score: number | null; // 0–100, or null when there's no data
  weight: number;
  detail: string;
};
export type HealthSuggestion = { text: string; tone: "info" | "warning" | "error"; href?: string };
export type InstitutionHealth = {
  overall: number;
  band: HealthBand;
  dimensions: HealthDimension[];
  suggestions: HealthSuggestion[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number | null) => (n === null ? null : Math.round(n));

export function bandOf(overall: number): HealthBand {
  if (overall >= 90) return "excellent";
  if (overall >= 75) return "good";
  if (overall >= 60) return "fair";
  return "attention";
}

export async function computeInstitutionHealth(tenantId: string): Promise<InstitutionHealth> {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY);

  const [attGroup, invAgg, paidAgg, overdueCount, marks, pending, students, teachers] = await Promise.all([
    prisma.attendance.groupBy({ by: ["status"], where: { tenantId, date: { gte: since } }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true }, _count: true }),
    prisma.payment.aggregate({ where: { invoice: { tenantId } }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { tenantId, status: { not: "PAID" }, dueDate: { lt: now } } }),
    prisma.mark.findMany({
      where: { exam: { tenantId } },
      select: { score: true, exam: { select: { maxScore: true } } },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
    prisma.user.count({ where: { tenantId, status: "PENDING" } }),
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.user.count({ where: { tenantId, role: "TEACHER", status: "ACTIVE" } }),
  ]);

  // ── Attendance ──────────────────────────────────────────────────────────
  let attPresent = 0;
  let attTotal = 0;
  for (const g of attGroup) {
    attTotal += g._count;
    if (g.status === "PRESENT" || g.status === "LATE") attPresent += g._count;
  }
  const attScore = attTotal ? (attPresent / attTotal) * 100 : null;

  // ── Fee collection ──────────────────────────────────────────────────────
  const invoiced = invAgg._sum.total ?? 0;
  const collected = paidAgg._sum.amount ?? 0;
  const outstanding = Math.max(0, invoiced - collected);
  const financeScore = invoiced ? clamp((collected / invoiced) * 100) : null;

  // ── Academics ───────────────────────────────────────────────────────────
  let pctSum = 0;
  let markN = 0;
  for (const m of marks) {
    const max = m.exam.maxScore || 100;
    if (max > 0) {
      pctSum += (m.score / max) * 100;
      markN++;
    }
  }
  const academicsScore = markN ? clamp(pctSum / markN) : null;

  // ── Operations ──────────────────────────────────────────────────────────
  const totalInvoices = invAgg._count ?? 0;
  const overdueRatio = totalInvoices ? overdueCount / totalInvoices : 0;
  let opsScore = 100 - overdueRatio * 45 - Math.min(20, pending * 5);
  const ratio = teachers > 0 ? students / teachers : 0;
  if (ratio > 30) opsScore -= Math.min(15, ratio - 30);
  opsScore = clamp(opsScore);

  const dimensions: HealthDimension[] = [
    {
      key: "attendance",
      label: "Attendance",
      score: round(attScore),
      weight: 0.3,
      detail: attTotal ? `${attPresent}/${attTotal} present · last 30 days` : "No attendance recorded yet",
    },
    {
      key: "finance",
      label: "Fee collection",
      score: round(financeScore),
      weight: 0.3,
      detail: invoiced ? `${inr(collected)} of ${inr(invoiced)} collected` : "No invoices issued yet",
    },
    {
      key: "academics",
      label: "Academics",
      score: round(academicsScore),
      weight: 0.25,
      detail: markN ? `avg ${round(academicsScore)}% across ${markN} result${markN === 1 ? "" : "s"}` : "No results recorded yet",
    },
    {
      key: "operations",
      label: "Operations",
      score: round(opsScore),
      weight: 0.15,
      detail: `${overdueCount} overdue · ${pending} pending approval${pending === 1 ? "" : "s"}`,
    },
  ];

  // Weighted overall over dimensions that actually have data.
  const available = dimensions.filter((d) => d.score !== null) as (HealthDimension & { score: number })[];
  const weightSum = available.reduce((s, d) => s + d.weight, 0) || 1;
  const overall = available.length ? Math.round(available.reduce((s, d) => s + d.score * d.weight, 0) / weightSum) : 0;

  // ── Suggestions (data-derived, severity-sorted, top 3) ────────────────────
  const raw: (HealthSuggestion & { sev: number })[] = [];
  if (attScore !== null && attScore < 85) {
    raw.push({ sev: 100 - attScore, tone: attScore < 70 ? "error" : "warning", text: `Attendance is ${Math.round(attScore)}% over 30 days — follow up on chronic absentees.` });
  }
  if (overdueCount > 0) {
    raw.push({ sev: 60 + Math.min(30, overdueCount), tone: "error", href: "/institution/fees", text: `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} overdue (${inr(outstanding)} outstanding) — send reminders.` });
  } else if (financeScore !== null && financeScore < 80) {
    raw.push({ sev: 100 - financeScore, tone: "warning", href: "/institution/fees", text: `Fee collection is ${Math.round(financeScore)}% — ${inr(outstanding)} still to collect.` });
  }
  if (pending > 0) {
    raw.push({ sev: 55 + pending, tone: "info", href: "/institution/join-requests", text: `${pending} join request${pending === 1 ? "" : "s"} awaiting your approval.` });
  }
  if (academicsScore !== null && academicsScore < 60) {
    raw.push({ sev: 100 - academicsScore, tone: "warning", href: "/institution/exams", text: `Average assessment score is ${Math.round(academicsScore)}% — review underperforming classes.` });
  }
  if (ratio > 30) {
    raw.push({ sev: 40 + (ratio - 30), tone: "info", text: `Student–teacher ratio is ${Math.round(ratio)}:1 — consider adding teaching staff.` });
  }
  // Onboarding nudges when a whole area has no data yet.
  if (attScore === null) raw.push({ sev: 30, tone: "info", href: "/teacher/attendance", text: "No attendance yet — start marking daily attendance to unlock insights." });
  if (financeScore === null) raw.push({ sev: 25, tone: "info", href: "/institution/fees", text: "No invoices yet — set up fee structures to track collection." });

  const suggestions = raw.sort((a, b) => b.sev - a.sev).slice(0, 3).map(({ text, tone, href }) => ({ text, tone, href }));

  return { overall, band: bandOf(overall), dimensions, suggestions };
}
