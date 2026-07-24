import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { normalizeDate } from "@/lib/engine";
import { dateShort, relative } from "@/lib/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TeacherHome() {
  const user = await requireRole("TEACHER");
  const staff = await prisma.staff.findUnique({ where: { userId: user.id } });
  const today = normalizeDate(new Date());
  const dow = new Date().getDay();

  const [todayTimetable, classesTaught, coursesCount, pendingGrading, upcomingExams] = await Promise.all([
    prisma.timetableEntry.findMany({
      where: { teacherId: staff?.id, dayOfWeek: dow },
      orderBy: { period: "asc" },
      include: { class: true, section: true, subject: true },
    }),
    staff
      ? prisma.timetableEntry.findMany({
          where: { teacherId: staff.id },
          distinct: ["sectionId"],
          include: { class: true, section: true },
        })
      : [],
    prisma.course.count({ where: { teacherId: user.id } }),
    prisma.assignmentSubmission.count({
      where: { assignment: { course: { teacherId: user.id } }, score: null },
    }),
    prisma.exam.findMany({
      where: {
        tenantId: user.tenantId!,
        scheduledAt: { gte: new Date() },
      },
      take: 5,
      orderBy: { scheduledAt: "asc" },
      include: { class: true, subject: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.displayName.split(" ")[0]}`}
        sub={`${DAYS[dow]} · ${todayTimetable.length} classes today`}
        actions={<Link href="/teacher/attendance" className="btn-primary">Mark attendance</Link>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="My classes" value={classesTaught.length} tone="accent" />
        <Stat label="Today's periods" value={todayTimetable.length} />
        <Stat label="Courses on LMS" value={coursesCount} />
        <Stat label="To grade" value={pendingGrading} tone={pendingGrading ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Today's schedule" className="lg:col-span-2">
          {todayTimetable.length === 0 && <div className="text-sm text-muted">Nothing scheduled today.</div>}
          <div className="space-y-2">
            {todayTimetable.map((t) => (
              <div key={t.id} className="flex items-baseline justify-between border-b border-border pb-2 last:border-0">
                <div>
                  <div className="text-fg font-medium">Period {t.period} · {t.subject.name}</div>
                  <div className="text-xs text-muted">{t.class.name} {t.section.name}{t.room ? ` · Room ${t.room}` : ""}</div>
                </div>
                <Tag>P{t.period}</Tag>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Upcoming exams">
          <ul className="space-y-2">
            {upcomingExams.map((e) => (
              <li key={e.id} className="pb-2 border-b border-border last:border-0">
                <div className="text-sm text-fg">{e.title}</div>
                <div className="text-xs text-muted">{e.class.name} · {e.subject.name} · {dateShort(e.scheduledAt)}</div>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Sections I teach" className="mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {classesTaught.map((t) => (
            <div key={t.id} className="border border-border rounded-lg p-3">
              <div className="text-fg font-medium">{t.class.name} {t.section.name}</div>
              <Link href={`/teacher/attendance?sectionId=${t.sectionId}`} className="text-xs text-accent">Mark attendance →</Link>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
