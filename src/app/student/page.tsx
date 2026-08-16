import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { dateShort, relative } from "@/lib/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function StudentHome() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    include: { class: true, section: true },
  });
  if (!student) return <EmptyState title="Not enrolled" sub="Ask the admin office to onboard you." />;
  const dow = new Date().getDay();

  const [timetableToday, courses, upcomingExams, pendingAssignments, notices] = await Promise.all([
    prisma.timetableEntry.findMany({
      where: { sectionId: student.sectionId, dayOfWeek: dow },
      orderBy: { period: "asc" },
      include: { subject: true, teacher: { include: { user: true } } },
    }),
    prisma.course.findMany({
      where: { tenantId: user.tenantId!, publishedAt: { not: null } },
      include: { subject: true, _count: { select: { lessons: true } } },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
    prisma.exam.findMany({
      where: { tenantId: user.tenantId!, classId: student.classId, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { subject: true },
      take: 5,
    }),
    prisma.assignment.findMany({
      where: {
        // Tenant-scoped via the course — prevents cross-tenant assignment leakage.
        course: { tenantId: user.tenantId! },
        dueAt: { gte: new Date() },
        submissions: { none: { studentId: student.id } },
      },
      include: { course: true },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.notice.findMany({
      where: { tenantId: user.tenantId!, audience: { in: ["ALL", "CLASS"] } },
      orderBy: { publishedAt: "desc" },
      take: 3,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Hi ${user.displayName.split(" ")[0]}!`}
        sub={`${student.class.name} · ${student.section.name} · ${DAYS[dow]}`}
        actions={<Link href="/student/assignments" className="btn-primary">Assignments</Link>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Periods today" value={timetableToday.length} tone="accent" />
        <Stat label="Pending assignments" value={pendingAssignments.length} tone={pendingAssignments.length ? "warning" : "success"} />
        <Stat label="Upcoming exams" value={upcomingExams.length} />
        <Stat label="Courses on LMS" value={courses.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Today's schedule" className="lg:col-span-2">
          {timetableToday.length === 0 && <div className="text-sm text-muted">Enjoy the break — no periods today.</div>}
          <div className="space-y-2">
            {timetableToday.map((t) => (
              <div key={t.id} className="flex items-baseline justify-between border-b border-border pb-2 last:border-0">
                <div>
                  <div className="text-fg font-medium">P{t.period} · {t.subject.name}</div>
                  <div className="text-xs text-muted">{t.teacher?.user.displayName ?? "TBD"}{t.room ? ` · Room ${t.room}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Pending assignments">
          {pendingAssignments.length === 0 && <div className="text-sm text-muted">All caught up. 🎯</div>}
          <ul className="space-y-2">
            {pendingAssignments.map((a) => (
              <li key={a.id} className="pb-2 border-b border-border last:border-0">
                <div className="text-sm text-fg">{a.title}</div>
                <div className="text-xs text-muted">{a.course.title} · due {dateShort(a.dueAt)}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Recent notices" className="mt-4">
        {notices.length === 0 && <div className="text-sm text-muted">No notices right now.</div>}
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
