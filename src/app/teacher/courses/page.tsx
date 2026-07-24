import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { createCourseAction } from "../actions";

export default async function TeacherCourses() {
  const user = await requireRole("TEACHER");
  const [courses, subjects] = await Promise.all([
    prisma.course.findMany({
      where: { teacherId: user.id },
      include: { subject: true, _count: { select: { lessons: true, assignments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subject.findMany({ where: { tenantId: user.tenantId! }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Courses (LMS)" sub="Structured content per subject · publish once, delivered to every enrolled section" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {courses.length === 0 && <div className="card p-6 text-sm text-muted">Create your first course →</div>}
          {courses.map((c) => (
            <Link href={`/teacher/courses/${c.id}`} key={c.id} className="card p-4 row-hover block">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-fg font-medium">{c.title}</div>
                  <div className="text-xs text-muted">{c.subject.name} · {c._count.lessons} lessons · {c._count.assignments} assignments</div>
                </div>
                <StatusBadge status={c.publishedAt ? "PUBLISHED" : "DRAFT"} />
              </div>
            </Link>
          ))}
        </div>
        <SectionCard title="New course">
          <form action={createCourseAction} className="space-y-3">
            <div><label className="label">Subject</label>
              <select className="select" name="subjectId">
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Summary</label><textarea className="textarea" name="summary" /></div>
            <button className="btn-primary w-full">Create course</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
