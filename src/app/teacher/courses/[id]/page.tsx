import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { addLessonAction, publishCourseAction } from "../../actions";

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("TEACHER");
  const course = await prisma.course.findFirst({
    where: { id, teacherId: user.id },
    include: { subject: true, lessons: { orderBy: { order: "asc" } }, assignments: true },
  });
  if (!course) notFound();
  return (
    <>
      <PageHeader
        title={course.title}
        sub={course.subject.name}
        actions={
          !course.publishedAt ? (
            <form action={publishCourseAction}>
              <input type="hidden" name="courseId" value={course.id} />
              <button className="btn-primary">Publish course</button>
            </form>
          ) : <StatusBadge status="PUBLISHED" />
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Lessons" className="lg:col-span-2">
          {course.lessons.length === 0 && <div className="text-sm text-muted">No lessons yet.</div>}
          <ol className="space-y-2">
            {course.lessons.map((l) => (
              <li key={l.id} className="border border-border rounded-lg p-3">
                <div className="text-fg font-medium">{l.order}. {l.title}</div>
                <div className="text-xs text-muted mt-0.5">{l.minutes} min · reading</div>
                <div className="text-sm text-muted mt-2 whitespace-pre-wrap">{l.body}</div>
              </li>
            ))}
          </ol>
        </SectionCard>
        <SectionCard title="Add lesson">
          <form action={addLessonAction} className="space-y-3">
            <input type="hidden" name="courseId" value={course.id} />
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Body</label><textarea className="textarea" name="body" required /></div>
            <div><label className="label">Minutes</label><input className="input" name="minutes" type="number" defaultValue={30} /></div>
            <button className="btn-secondary w-full">Add lesson</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
