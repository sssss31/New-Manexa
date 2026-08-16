import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { createAssignmentAction, gradeAction } from "../actions";

export default async function TeacherAssignments() {
  const user = await requireRole("TEACHER");
  const [courses, assignments, ungraded] = await Promise.all([
    prisma.course.findMany({ where: { teacherId: user.id }, orderBy: { title: "asc" } }),
    prisma.assignment.findMany({
      where: { course: { teacherId: user.id } },
      include: { course: true, _count: { select: { submissions: true } } },
      orderBy: { dueAt: "desc" },
    }),
    prisma.assignmentSubmission.findMany({
      where: { assignment: { course: { teacherId: user.id } }, score: null },
      include: { assignment: true, student: { include: { user: true } } },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);
  return (
    <>
      <PageHeader title="Assignments" sub="Create, distribute, grade" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Assignments" className="lg:col-span-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Title</th>
                <th className="th">Course</th>
                <th className="th">Due</th>
                <th className="th">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="row-hover">
                  <td className="td font-medium">{a.title}</td>
                  <td className="td text-muted">{a.course.title}</td>
                  <td className="td">{dateShort(a.dueAt)}</td>
                  <td className="td tabular-nums">{a._count.submissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="New assignment">
          <form action={createAssignmentAction} className="space-y-3">
            <div><label className="label">Course</label>
              <select className="select" name="courseId">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Instructions</label><textarea className="textarea" name="instructions" required /></div>
            <div><label className="label">Due date</label><input className="input" name="dueAt" type="datetime-local" required /></div>
            <div><label className="label">Max score</label><input className="input" name="maxScore" type="number" defaultValue={100} /></div>
            <button className="btn-primary w-full">Create</button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Awaiting grading" className="mt-4">
        {ungraded.length === 0 && <div className="text-sm text-muted">All caught up. 🎉</div>}
        <div className="space-y-3">
          {ungraded.map((s) => (
            <form key={s.id} action={gradeAction} className="border border-border rounded-lg p-3">
              <input type="hidden" name="submissionId" value={s.id} />
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-fg font-medium">{s.student.user.displayName}</div>
                  <div className="text-xs text-muted">{s.assignment.title}</div>
                  <div className="text-sm text-muted mt-1 max-w-2xl truncate">{s.content}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input className="input w-24" name="score" type="number" placeholder="/100" required />
                  <input className="input w-56" name="feedback" placeholder="Feedback…" />
                  <button className="btn-secondary">Grade</button>
                </div>
              </div>
              <Tag>Submitted {new Date(s.submittedAt).toLocaleDateString()}</Tag>
            </form>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
