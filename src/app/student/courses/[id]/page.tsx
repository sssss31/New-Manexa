import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { dateShort } from "@/lib/format";

export default async function StudentCourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("STUDENT");
  const course = await prisma.course.findFirst({
    where: { id, tenantId: user.tenantId!, publishedAt: { not: null } },
    include: { subject: true, lessons: { orderBy: { order: "asc" } }, assignments: true },
  });
  if (!course) notFound();
  return (
    <>
      <PageHeader title={course.title} sub={course.subject.name} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Lessons" className="lg:col-span-2">
          {course.lessons.length === 0 && <div className="text-sm text-muted">No lessons yet.</div>}
          <ol className="space-y-3">
            {course.lessons.map((l) => (
              <li key={l.id} className="border border-border rounded-lg p-3">
                <div className="text-fg font-medium">{l.order}. {l.title}</div>
                <div className="text-xs text-muted mt-0.5">{l.minutes} min · reading</div>
                <div className="text-sm text-muted mt-2 whitespace-pre-wrap">{l.body}</div>
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard title="Assignments">
          {course.assignments.length === 0 && <div className="text-sm text-muted">No assignments yet.</div>}
          <ul className="space-y-2">
            {course.assignments.map((a) => (
              <li key={a.id} className="border border-border rounded-lg p-3">
                <div className="text-fg font-medium">{a.title}</div>
                <Tag>Due {dateShort(a.dueAt)}</Tag>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
