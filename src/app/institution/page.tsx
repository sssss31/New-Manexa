import Link from "next/link";
import {
  Users, GraduationCap, Wallet, IndianRupee, CalendarCheck, UserPlus, ClipboardList,
  Megaphone, Activity, Sparkles, ArrowUpRight, TrendingUp, BellRing, Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { StatusBadge, Tag } from "@/components/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/Charts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/Reveal";
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

  const quickActions = [
    { href: "/institution/students", label: "Students", icon: Users },
    { href: "/institution/leads", label: "Admissions", icon: UserPlus },
    { href: "/institution/fees", label: "Fees", icon: Wallet },
    { href: "/institution/exams", label: "Exams", icon: ClipboardList },
    { href: "/institution/assistant", label: "AI Assistant", icon: Sparkles },
    { href: "/institution/notices", label: "Notices", icon: Megaphone },
  ];

  return (
    <div className="relative">
      {/* Subtle aurora canvas */}
      <div className="dash-orb dash-orb-green w-[420px] h-[420px] -top-24 -left-24" aria-hidden />
      <div className="dash-orb dash-orb-navy w-[380px] h-[380px] top-40 right-[-120px]" aria-hidden />

      {/* Header */}
      <Reveal className="relative z-[1] flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <div className="mkt-chip mb-3 !text-xs"><span className="dot" /> {user.tenantId ? "Live cockpit" : ""}</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight font-display">
            Good {greeting()}, <span className="mkt-gradient-text">{user.displayName.split(" ")[0]}</span>
          </h1>
          <p className="text-sm text-muted mt-1.5">Everything you need to run the day, at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/institution/leads" className="btn-secondary">Leads</Link>
          <Link href="/institution/notices" className="btn-primary gap-1.5"><Plus size={15} /> New notice</Link>
        </div>
      </Reveal>

      {/* Subscription / seat status — only renders when action is needed */}
      <div className="relative z-[1]">
        <BillingBanner tenantId={tenantId} />
      </div>

      {/* KPI grid */}
      <RevealGroup className="relative z-[1] grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <RevealItem><KpiCard icon={<Users size={18} />} label="Students" value={students.toLocaleString()} sub={`${classes} classes`} tone="accent" accentBar /></RevealItem>
        <RevealItem><KpiCard icon={<GraduationCap size={18} />} label="Staff" value={staff.toLocaleString()} sub="Teaching & admin" /></RevealItem>
        <RevealItem><KpiCard icon={<Wallet size={18} />} label="Fee due" value={inr(invoicesDue._sum.total ?? 0)} sub={`${invoicesDue._count ?? 0} invoices`} tone="error" /></RevealItem>
        <RevealItem><KpiCard icon={<IndianRupee size={18} />} label="Collected · month" value={inr(collectedThisMonth._sum.amount ?? 0)} tone="success" /></RevealItem>
      </RevealGroup>
      <RevealGroup className="relative z-[1] grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <RevealItem><KpiCard icon={<CalendarCheck size={18} />} label="Attendance today" value={`${attendancePct}%`} sub={`${presentToday} present · ${absentToday} absent`} tone={attendancePct >= 90 ? "success" : attendancePct > 0 ? "warning" : "default"} /></RevealItem>
        <RevealItem><KpiCard icon={<UserPlus size={18} />} label="Open leads" value={leadsOpen} sub="Active pipeline" tone="warning" /></RevealItem>
        <RevealItem><KpiCard icon={<ClipboardList size={18} />} label="Upcoming exams" value={upcomingExams.length} sub="Scheduled" /></RevealItem>
        <RevealItem><KpiCard icon={<Megaphone size={18} />} label="Notices" value={recentNotices.length} sub="Recent" /></RevealItem>
      </RevealGroup>

      {/* Analytics */}
      <Reveal className="relative z-[1] grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Panel title="Attendance trend" icon={<TrendingUp size={15} />} right="last 10 days · %" className="lg:col-span-2">
          {attData.length > 1 ? (
            <AreaChart data={attData} labels={attLabels} suffix="%" />
          ) : (
            <EmptyMini icon={<CalendarCheck size={22} />} text="Not enough attendance data yet." />
          )}
        </Panel>
        <Panel title="Fee mix" icon={<Wallet size={15} />} right="₹ thousands">
          {feeSeg.some((s) => s.value > 0) ? (
            <DonutChart segments={feeSeg} centerLabel={`${feeSeg.reduce((s, x) => s + x.value, 0)}k`} centerSub="invoiced" />
          ) : (
            <EmptyMini icon={<Wallet size={22} />} text="No invoices yet." />
          )}
        </Panel>
      </Reveal>

      <Reveal className="relative z-[1] mb-4">
        <Panel title="Class strength" icon={<Users size={15} />} right="students per class">
          {classBars.length ? <BarChart data={classBars} /> : <EmptyMini icon={<Users size={22} />} text="No classes yet." />}
        </Panel>
      </Reveal>

      {/* Quick actions */}
      <Reveal className="relative z-[1] mb-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className="glass-card glass-card-hover p-4 flex flex-col items-center justify-center gap-2 text-center group">
              <span className="icon-chip group-hover:bg-accent/20 transition-colors"><a.icon size={18} /></span>
              <span className="text-xs text-muted group-hover:text-fg transition-colors">{a.label}</span>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* Detail grid */}
      <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Reveal className="lg:col-span-2">
          <Panel title="Upcoming exams" icon={<ClipboardList size={15} />} right={<Link href="/institution/exams" className="text-accent hover:underline">All exams</Link>}>
            {upcomingExams.length === 0 ? (
              <EmptyMini icon={<ClipboardList size={22} />} text="No exams scheduled." />
            ) : (
              <ul className="space-y-1">
                {upcomingExams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                    <div>
                      <div className="text-fg font-medium text-sm">{e.title}</div>
                      <div className="text-xs text-muted">{e.class.name} · {e.subject.name} · {e.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-fg tabular-nums">{dateShort(e.scheduledAt)}</div>
                      <StatusBadge status={e.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.05}>
          <Panel title="Recent notices" icon={<BellRing size={15} />} right={<Link href="/institution/notices" className="text-accent hover:underline">All</Link>}>
            {recentNotices.length === 0 ? (
              <EmptyMini icon={<Megaphone size={22} />} text="No notices yet." />
            ) : (
              <ul className="space-y-2.5">
                {recentNotices.map((n) => (
                  <li key={n.id} className="pb-2.5 border-b border-white/8 last:border-0 last:pb-0">
                    <div className="text-sm text-fg">{n.title}</div>
                    <div className="text-xs text-muted flex items-center gap-2 mt-1">
                      <Tag>{n.audience}</Tag>
                      {relative(n.publishedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>
      </div>

      {/* AI insight teaser + Recent activity */}
      <div className="relative z-[1] grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Reveal>
          <Panel title="AI insight" icon={<Sparkles size={15} />}>
            <div className="flex flex-col h-full">
              <p className="text-sm text-muted leading-relaxed">
                Let the AI surface at-risk students, likely fee defaulters and attendance dips — computed live from your data.
              </p>
              <Link href="/institution/ai" className="btn-primary w-full justify-center mt-4 gap-1.5">
                Open AI Insights <ArrowUpRight size={15} />
              </Link>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-2">
          <Panel title="Recent activity" icon={<Activity size={15} />} right={<Link href="/institution/audit" className="text-accent hover:underline">Audit log</Link>}>
            {recentAudit.length === 0 ? (
              <EmptyMini icon={<Activity size={22} />} text="No activity yet." />
            ) : (
              <ul className="space-y-0.5">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
                    <div className="text-sm min-w-0">
                      <span className="text-fg">{a.action.replace(/_/g, " ")}</span>
                      <span className="text-muted"> · {a.entity}{a.detail ? ` · ${a.detail}` : ""}</span>
                    </div>
                    <div className="text-xs text-subtle whitespace-nowrap">{a.actor?.displayName ?? "system"} · {relative(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}

function EmptyMini({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center text-subtle">{icon}</span>
      <span className="text-sm text-muted">{text}</span>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
