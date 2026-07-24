import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, ProgressBar, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/Charts";
import { inr, relative, dateShort } from "@/lib/format";
import { normalizeDate } from "@/lib/engine";

export default async function InstitutionCockpit() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const today = normalizeDate(new Date());

  const [
    students,
    staff,
    classes,
    leadsOpen,
    presentToday,
    absentToday,
    invoicesDue,
    collectedThisMonth,
    recentNotices,
    recentAudit,
    upcomingExams,
  ] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.staff.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.class.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, stage: { notIn: ["CONFIRMED", "LOST"] } } }),
    prisma.attendance.count({ where: { tenantId, date: today, status: "PRESENT" } }),
    prisma.attendance.count({ where: { tenantId, date: today, status: "ABSENT" } }),
    prisma.invoice.aggregate({
      where: { tenantId, status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }, invoice: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.notice.findMany({ where: { tenantId }, orderBy: { publishedAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: true } }),
    prisma.exam.findMany({
      where: { tenantId, scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      include: { class: true, subject: true },
    }),
  ]);
  const totalMarked = presentToday + absentToday;
  const attendancePct = totalMarked ? Math.round((presentToday / totalMarked) * 100) : 0;

  // ---- Chart data ----
  const since = new Date(Date.now() - 20 * 86400000);
  const [attRows, invByStatus, classStrength] = await Promise.all([
    prisma.attendance.findMany({ where: { tenantId, date: { gte: since } }, select: { date: true, status: true } }),
    prisma.invoice.groupBy({ by: ["status"], where: { tenantId }, _sum: { total: true } }),
    prisma.class.findMany({ where: { tenantId }, include: { _count: { select: { students: true } } }, orderBy: { name: "asc" }, take: 6 }),
  ]);
  // Attendance % per day (last ~10 school days).
  const byDay = new Map<string, { p: number; t: number }>();
  for (const r of attRows) {
    const k = r.date.toISOString().slice(0, 10);
    const d = byDay.get(k) ?? { p: 0, t: 0 };
    d.t++;
    if (r.status === "PRESENT" || r.status === "LATE") d.p++;
    byDay.set(k, d);
  }
  const attSeries = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-10);
  const attData = attSeries.map(([, v]) => (v.t ? Math.round((v.p / v.t) * 100) : 0));
  const attLabels = attSeries.map(([k]) => k.slice(5));
  const feeSeg = ["PAID", "DUE", "OVERDUE"].map((s) => ({
    label: s.charAt(0) + s.slice(1).toLowerCase(),
    value: Math.round((invByStatus.find((i) => i.status === s)?._sum.total ?? 0) / 1000),
  }));
  const classBars = classStrength.map((c) => ({ label: c.name.replace(/^(Class|Grade|Batch|Year)\s*/i, ""), value: c._count.students }));

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user.displayName.split(" ")[0]}`}
        sub="Live cockpit for the institution — everything you need to run the day."
        actions={
          <>
            <Link href="/institution/leads" className="btn-secondary">Leads</Link>
            <Link href="/institution/notices" className="btn-primary">+ New notice</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Students" value={students.toLocaleString()} sub={`${classes} classes`} tone="accent" />
        <Stat label="Staff" value={staff.toLocaleString()} />
        <Stat label="Open leads" value={leadsOpen} sub="Active pipeline" tone="warning" />
        <Stat label="Fee due" value={inr(invoicesDue._sum.total ?? 0)} sub={`${invoicesDue._count ?? 0} invoices`} tone="error" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="stat-label">Attendance today</div>
          <div className="stat-value">{attendancePct}%</div>
          <div className="mt-2"><ProgressBar value={attendancePct} tone={attendancePct >= 90 ? "success" : "warning"} /></div>
          <div className="stat-sub mt-2">{presentToday} present · {absentToday} absent · {totalMarked} marked</div>
        </div>
        <Stat label="Collected · this month" value={inr(collectedThisMonth._sum.amount ?? 0)} tone="success" />
        <Stat label="Upcoming exams" value={upcomingExams.length} />
        <Stat label="Notices posted" value={recentNotices.length} sub="Last 5" />
      </div>

      {/* Visual analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Attendance trend" right={<span className="text-xs text-muted">last 10 days · %</span>} className="lg:col-span-2">
          {attData.length > 1 ? (
            <AreaChart data={attData} labels={attLabels} suffix="%" />
          ) : (
            <div className="text-sm text-muted py-8 text-center">Not enough attendance data yet.</div>
          )}
        </SectionCard>
        <SectionCard title="Fee mix" right={<span className="text-xs text-muted">₹ thousands</span>}>
          {feeSeg.some((s) => s.value > 0) ? (
            <DonutChart
              segments={feeSeg}
              centerLabel={`${feeSeg.reduce((s, x) => s + x.value, 0)}k`}
              centerSub="invoiced"
            />
          ) : (
            <div className="text-sm text-muted py-8 text-center">No invoices yet.</div>
          )}
        </SectionCard>
      </div>
      <SectionCard title="Class strength" right={<span className="text-xs text-muted">students per class</span>} className="mb-4">
        {classBars.length ? <BarChart data={classBars} /> : <div className="text-sm text-muted">No classes yet.</div>}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Upcoming exams" className="lg:col-span-2">
          {upcomingExams.length === 0 && <div className="text-sm text-muted">No exams scheduled.</div>}
          <ul className="space-y-2">
            {upcomingExams.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <div>
                  <div className="text-fg font-medium">{e.title}</div>
                  <div className="text-xs text-muted">{e.class.name} · {e.subject.name} · {e.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-fg">{dateShort(e.scheduledAt)}</div>
                  <StatusBadge status={e.status} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Recent notices">
          {recentNotices.length === 0 && <div className="text-sm text-muted">No notices yet.</div>}
          <ul className="space-y-2">
            {recentNotices.map((n) => (
              <li key={n.id} className="pb-2 border-b border-border last:border-0">
                <div className="text-sm text-fg">{n.title}</div>
                <div className="text-xs text-muted flex items-center gap-2">
                  <Tag>{n.audience}</Tag>
                  {relative(n.publishedAt)}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Recent activity" className="mt-4">
        <ul className="space-y-2">
          {recentAudit.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between border-b border-border pb-1.5 last:border-0">
              <div className="text-sm">
                <span className="text-fg">{a.action.replace(/_/g, " ")}</span>
                <span className="text-muted"> · {a.entity}{a.detail ? ` · ${a.detail}` : ""}</span>
              </div>
              <div className="text-xs text-muted">{a.actor?.displayName ?? "system"} · {relative(a.createdAt)}</div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
