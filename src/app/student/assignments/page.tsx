import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { submitAssignmentAction } from "../actions";

export default async function StudentAssignments() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!student) return <EmptyState title="Not enrolled" />;
  const assignments = await prisma.assignment.findMany({
    where: { course: { tenantId: user.tenantId! } },
    include: {
      course: { include: { subject: true } },
      submissions: { where: { studentId: student.id } },
    },
    orderBy: { dueAt: "desc" },
    take: 40,
  });
  return (
    <>
      <PageHeader title="Assignments" sub="Submit inline · rubric grading in Phase 2" />
      <div className="space-y-3">
        {assignments.map((a) => {
          const sub = a.submissions[0];
          const overdue = !sub && a.dueAt < new Date();
          return (
            <div key={a.id} className="card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-fg font-medium">{a.title}</div>
                  <div className="text-xs text-muted">{a.course.subject.name} · {a.course.title}</div>
                  <div className="text-sm text-muted mt-2 max-w-2xl whitespace-pre-wrap">{a.instructions}</div>
                </div>
                <div className="text-right shrink-0">
                  <Tag tone={overdue ? "warning" : "muted"}>Due {dateShort(a.dueAt)}</Tag>
                  {sub && (
                    <div className="mt-2">
                      <StatusBadge status={sub.score !== null ? "GRADED" : "SUBMITTED"} />
                      {sub.score !== null && <div className="text-sm text-fg mt-1">{sub.score} / {a.maxScore}</div>}
                    </div>
                  )}
                </div>
              </div>
              {!sub && (
                <form action={submitAssignmentAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <input className="input flex-1" name="content" placeholder="Write your answer / paste your submission link…" required />
                  <button className="btn-primary">Submit</button>
                </form>
              )}
              {sub && sub.feedback && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="text-xs uppercase tracking-wider text-muted">Feedback</div>
                  <div className="text-sm text-fg">{sub.feedback}</div>
                </div>
              )}
            </div>
          );
        })}
        {assignments.length === 0 && (
          <SectionCard><div className="text-sm text-muted">No assignments yet.</div></SectionCard>
        )}
      </div>
    </>
  );
}
