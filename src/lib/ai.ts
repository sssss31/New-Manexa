// MANEXA AI engine — deterministic, explainable heuristics over live tenant
// data. Each scorer returns feature attributions so the UI can explain WHY.
// The interface is model-agnostic: swap `scoreRisk` internals for an ML
// endpoint (SageMaker/KServe per SAD §12.4) without touching callers.

import { prisma } from "./prisma";

export type RiskBand = "HIGH" | "MEDIUM" | "LOW";

export interface StudentRisk {
  studentId: string;
  name: string;
  className: string;
  attendancePct: number; // 0-100
  avgMarkPct: number; // 0-100 normalized to exam max
  duesInr: number;
  score: number; // 0-1
  band: RiskBand;
  reasons: string[];
}

export async function riskReport(tenantId: string, limit = 50): Promise<StudentRisk[]> {
  const students = await prisma.student.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      user: true,
      class: true,
      section: true,
      attendance: { orderBy: { date: "desc" }, take: 30 },
      marks: { include: { exam: true } },
      invoices: { where: { status: { in: ["DUE", "OVERDUE"] } } },
    },
  });

  const out: StudentRisk[] = students.map((s) => {
    const att = s.attendance.length
      ? s.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / s.attendance.length
      : 1;
    const markPcts = s.marks.map((m) => (m.score / Math.max(1, m.exam.maxScore)) * 100);
    const avgMark = markPcts.length ? markPcts.reduce((a, b) => a + b, 0) / markPcts.length : 70;
    const dues = s.invoices.reduce((sum, i) => sum + i.total, 0);

    // Weighted composite: attendance 45%, academics 35%, fee stress 20%.
    const score =
      0.45 * (1 - att) +
      0.35 * (1 - avgMark / 100) +
      0.2 * (dues > 0 ? Math.min(1, dues / 10000) : 0);

    const reasons: string[] = [];
    if (att < 0.75) reasons.push(`Attendance ${Math.round(att * 100)}% — below 75% eligibility line`);
    else if (att < 0.9) reasons.push(`Attendance slipping (${Math.round(att * 100)}%)`);
    if (avgMark < 45) reasons.push(`Average score ${Math.round(avgMark)}% — failing territory`);
    else if (avgMark < 60) reasons.push(`Average score ${Math.round(avgMark)}% — below class median`);
    if (dues > 0) reasons.push(`₹${dues.toLocaleString("en-IN")} fees outstanding`);
    if (reasons.length === 0) reasons.push("No risk factors detected");

    return {
      studentId: s.id,
      name: s.user.displayName,
      className: `${s.class.name} ${s.section.name}`,
      attendancePct: Math.round(att * 100),
      avgMarkPct: Math.round(avgMark),
      duesInr: dues,
      score: Math.round(score * 100) / 100,
      band: score > 0.45 ? "HIGH" : score > 0.28 ? "MEDIUM" : "LOW",
      reasons,
    };
  });

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface DefaulterForecast {
  studentId: string;
  name: string;
  className: string;
  openDuesInr: number;
  overdueCount: number;
  latePaymentRatio: number; // 0-1 historic
  probability: number; // 0-1
}

export async function defaulterForecast(tenantId: string, limit = 20): Promise<DefaulterForecast[]> {
  const students = await prisma.student.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      user: true,
      class: true,
      section: true,
      invoices: { include: { payments: true } },
    },
  });

  const out: DefaulterForecast[] = [];
  for (const s of students) {
    const invs = s.invoices;
    if (!invs.length) continue;
    const overdue = invs.filter((i) => i.status === "OVERDUE" || (i.status === "DUE" && i.dueDate < new Date()));
    const paid = invs.filter((i) => i.status === "PAID");
    const paidLate = paid.filter((i) => i.paidAt && i.paidAt > i.dueDate);
    const lateRatio = paid.length ? paidLate.length / paid.length : 0;
    const openDues = overdue.reduce((sum, i) => sum + i.total, 0);
    const probability = Math.min(0.97, 0.55 * (overdue.length > 0 ? 1 : 0) + 0.3 * lateRatio + 0.15 * Math.min(1, openDues / 8000));
    if (probability < 0.2) continue;
    out.push({
      studentId: s.id,
      name: s.user.displayName,
      className: `${s.class.name} ${s.section.name}`,
      openDuesInr: openDues,
      overdueCount: overdue.length,
      latePaymentRatio: Math.round(lateRatio * 100) / 100,
      probability: Math.round(probability * 100) / 100,
    });
  }
  return out.sort((a, b) => b.probability - a.probability).slice(0, limit);
}

export interface AttendanceTrend {
  last7Pct: number;
  prev7Pct: number;
  deltaPct: number;
  forecastTomorrowPct: number;
  daysAnalyzed: number;
}

export async function attendanceTrend(tenantId: string): Promise<AttendanceTrend> {
  const since = new Date(Date.now() - 20 * 86400000);
  const rows = await prisma.attendance.findMany({
    where: { tenantId, date: { gte: since } },
    select: { date: true, status: true },
  });
  const byDay = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    const k = r.date.toISOString().slice(0, 10);
    const d = byDay.get(k) ?? { present: 0, total: 0 };
    d.total++;
    if (r.status === "PRESENT" || r.status === "LATE") d.present++;
    byDay.set(k, d);
  }
  const days = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, v]) => (v.total ? (v.present / v.total) * 100 : 0));
  const last7 = days.slice(-7);
  const prev7 = days.slice(-14, -7);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const last3 = days.slice(-3);
  return {
    last7Pct: Math.round(avg(last7)),
    prev7Pct: Math.round(avg(prev7)),
    deltaPct: Math.round(avg(last7) - avg(prev7)),
    forecastTomorrowPct: Math.round(avg(last3.length ? last3 : last7)),
    daysAnalyzed: days.length,
  };
}

// ---- Natural-language query answering (intent router) ----

export interface AiAnswer {
  title: string;
  text: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  followups: string[];
}

const FOLLOWUPS = [
  "Which students are at risk?",
  "Who is likely to default on fees?",
  "How is attendance trending?",
  "Who are the top performers?",
  "How many students per class?",
  "Total fees outstanding",
];

export async function answerQuery(tenantId: string, q: string): Promise<AiAnswer> {
  const query = q.toLowerCase().trim();

  if (/at.?risk|risk|struggl|drop.?out/.test(query)) {
    const risks = (await riskReport(tenantId, 8)).filter((r) => r.band !== "LOW");
    return {
      title: "Students needing attention",
      text: risks.length
        ? `${risks.length} students score MEDIUM or HIGH on the composite risk model (attendance 45% · academics 35% · fee stress 20%).`
        : "No students currently score above the risk threshold. 🎉",
      table: {
        columns: ["Student", "Class", "Attendance", "Avg score", "Dues", "Band"],
        rows: risks.map((r) => [r.name, r.className, `${r.attendancePct}%`, `${r.avgMarkPct}%`, `₹${r.duesInr.toLocaleString("en-IN")}`, r.band]),
      },
      followups: FOLLOWUPS,
    };
  }

  if (/default|overdue|pending fee|outstanding|dues/.test(query)) {
    const [forecast, agg] = await Promise.all([
      defaulterForecast(tenantId, 8),
      prisma.invoice.aggregate({ where: { tenantId, status: { in: ["DUE", "OVERDUE"] } }, _sum: { total: true }, _count: true }),
    ]);
    return {
      title: "Fee default forecast",
      text: `₹${(agg._sum.total ?? 0).toLocaleString("en-IN")} outstanding across ${agg._count} invoices. ${forecast.length} families show elevated default probability based on overdue status and historic payment lateness.`,
      table: {
        columns: ["Student", "Class", "Open dues", "Overdue invoices", "Late-pay ratio", "P(default)"],
        rows: forecast.map((f) => [f.name, f.className, `₹${f.openDuesInr.toLocaleString("en-IN")}`, f.overdueCount, f.latePaymentRatio, f.probability]),
      },
      followups: FOLLOWUPS,
    };
  }

  if (/attendance/.test(query)) {
    const t = await attendanceTrend(tenantId);
    const dir = t.deltaPct > 0 ? "improving" : t.deltaPct < 0 ? "declining" : "flat";
    return {
      title: "Attendance trend",
      text: `Last 7 school days averaged ${t.last7Pct}% vs ${t.prev7Pct}% the week before — ${dir} (${t.deltaPct > 0 ? "+" : ""}${t.deltaPct} pts). Tomorrow's forecast: ~${t.forecastTomorrowPct}% based on the 3-day moving average. ${t.daysAnalyzed} days analyzed.`,
      followups: FOLLOWUPS,
    };
  }

  if (/top|best|perform|topper/.test(query)) {
    const marks = await prisma.mark.findMany({
      where: { exam: { tenantId, status: "PUBLISHED" } },
      include: { student: { include: { user: true, class: true, section: true } }, exam: true },
    });
    const byStudent = new Map<string, { name: string; cls: string; total: number; n: number }>();
    for (const m of marks) {
      const k = m.studentId;
      const e = byStudent.get(k) ?? { name: m.student.user.displayName, cls: `${m.student.class.name} ${m.student.section.name}`, total: 0, n: 0 };
      e.total += (m.score / Math.max(1, m.exam.maxScore)) * 100;
      e.n++;
      byStudent.set(k, e);
    }
    const top = Array.from(byStudent.values())
      .map((e) => ({ ...e, avg: Math.round(e.total / e.n) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
    return {
      title: "Top performers (published exams)",
      text: top.length ? `Ranked by normalized average across ${marks.length} published marks.` : "No published exam results yet.",
      table: { columns: ["Student", "Class", "Avg %"], rows: top.map((t) => [t.name, t.cls, t.avg]) },
      followups: FOLLOWUPS,
    };
  }

  if (/how many|count|strength|per class/.test(query)) {
    const classes = await prisma.class.findMany({
      where: { tenantId },
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });
    const total = classes.reduce((s, c) => s + c._count.students, 0);
    return {
      title: "Enrolment by class",
      text: `${total} active students across ${classes.length} classes.`,
      table: { columns: ["Class", "Students"], rows: classes.map((c) => [c.name, c._count.students]) },
      followups: FOLLOWUPS,
    };
  }

  // Fallback: entity search across students and leads
  const [students, leads] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, user: { displayName: { contains: q } } },
      include: { user: true, class: true, section: true },
      take: 5,
    }),
    prisma.lead.findMany({ where: { tenantId, studentName: { contains: q } }, take: 5 }),
  ]);
  if (students.length || leads.length) {
    return {
      title: `Search results for "${q}"`,
      text: `${students.length} student(s), ${leads.length} lead(s) matched.`,
      table: {
        columns: ["Type", "Name", "Detail"],
        rows: [
          ...students.map((s) => ["Student", s.user.displayName, `${s.class.name} ${s.section.name} · Adm ${s.admissionNo}`] as (string | number)[]),
          ...leads.map((l) => ["Lead", l.studentName, `${l.gradeInterest} · ${l.stage}`] as (string | number)[]),
        ],
      },
      followups: FOLLOWUPS,
    };
  }

  return {
    title: "I couldn't match that query",
    text: "Try one of the suggestions below — the assistant currently answers questions about risk, fees, attendance, performance and enrolment, and searches students & leads by name. (Heuristic engine — LLM backend pluggable via the same interface.)",
    followups: FOLLOWUPS,
  };
}
