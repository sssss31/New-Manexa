import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";

export default async function StudentCourses() {
  const user = await requireRole("STUDENT");
  const courses = await prisma.course.findMany({
    where: { tenantId: user.tenantId!, publishedAt: { not: null } },
    include: { subject: true, _count: { select: { lessons: true, assignments: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <>
      <PageHeader title="My courses" sub="LMS content published for your class" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => (
          <Link key={c.id} href={`/student/courses/${c.id}`} className="card p-4 row-hover block">
            <div className="text-fg font-medium">{c.title}</div>
            <div className="text-xs text-muted mt-0.5">{c.subject.name}</div>
            <div className="text-xs text-muted mt-2">{c._count.lessons} lessons · {c._count.assignments} assignments</div>
          </Link>
        ))}
      </div>
      {courses.length === 0 && (
        <SectionCard>
          <div className="text-sm text-muted">No published courses yet.</div>
        </SectionCard>
      )}
    </>
  );
}
