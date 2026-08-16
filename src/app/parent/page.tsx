import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { inr, dateShort, relative } from "@/lib/format";

export default async function ParentHome() {
  const user = await requireRole("PARENT");
  const students = await loadParentChildren(user.id);
  const kid = students[0];
  if (!kid) {
    return (
      <>
        <PageHeader title={`Hello, ${user.displayName.split(" ")[0]}`} />
        <EmptyState title="No child linked yet" sub="Contact the school office to link your account." />
      </>
    );
  }

  const [invoices, attendance, upcomingExams, notices] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: kid.id },
      orderBy: { issueDate: "desc" },
      take: 6,
    }),
    prisma.attendance.findMany({
      where: { studentId: kid.id },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.exam.findMany({
      where: { classId: kid.classId, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { subject: true },
    }),
    prisma.notice.findMany({
      where: { tenantId: kid.tenantId, audience: { in: ["ALL", "PARENTS", "CLASS"] } },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
  ]);

  const attPct = attendance.length
    ? Math.round((attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100)
    : 100;
  const due = invoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.total, 0);

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user.displayName.split(" ")[0]}`}
        sub={`${kid.user.displayName} · ${kid.class.name} ${kid.section.name}`}
        actions={<Link href="/parent/fees" className="btn-primary">Pay fees</Link>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Attendance" value={`${attPct}%`} sub={`last ${attendance.length} days`} tone={attPct >= 75 ? "success" : "warning"} />
        <Stat label="Fees due" value={inr(due)} tone={due ? "error" : "success"} />
        <Stat label="Upcoming exams" value={upcomingExams.length} />
        <Stat label="Transport" value={kid.transportAlloc ? "Opted" : "—"} sub={kid.transportAlloc?.route.name ?? "Not opted"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Recent attendance" className="lg:col-span-2">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {attendance.slice(0, 12).map((a) => (
              <li key={a.id} className="border border-border rounded-lg p-2">
                <div className="text-xs text-muted">{dateShort(a.date)}</div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Upcoming">
          <ul className="space-y-2">
            {upcomingExams.map((e) => (
              <li key={e.id} className="pb-2 border-b border-border last:border-0">
                <div className="text-sm text-fg">{e.title}</div>
                <div className="text-xs text-muted">{e.subject.name} · {dateShort(e.scheduledAt)}</div>
              </li>
            ))}
            {upcomingExams.length === 0 && <div className="text-sm text-muted">No exams scheduled.</div>}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Recent notices" className="mt-4">
        {notices.length === 0 && <div className="text-sm text-muted">No notices yet.</div>}
        <ul className="space-y-2">
          {notices.map((n) => (
            <li key={n.id} className="flex items-baseline justify-between border-b border-border pb-2 last:border-0">
              <div>
                <div className="text-sm text-fg">{n.title}</div>
                <div className="text-xs text-muted">{n.body}</div>
              </div>
              <div className="text-right">
                <Tag>{n.audience}</Tag>
                <div className="text-xs text-muted">{relative(n.publishedAt)}</div>
              </div>
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
