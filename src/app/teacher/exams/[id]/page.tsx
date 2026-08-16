import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { enterMarksAction, publishExamAction } from "../../actions";

export default async function ExamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("TEACHER");
  const exam = await prisma.exam.findFirst({
    where: { id, tenantId: user.tenantId! },
    include: {
      class: { include: { students: { include: { user: true, marks: { where: { examId: id } } } } } },
      subject: true,
    },
  });
  if (!exam) notFound();

  return (
    <>
      <PageHeader
        title={exam.title}
        sub={`${exam.class.name} · ${exam.subject.name} · ${exam.type} · ${dateShort(exam.scheduledAt)}`}
        actions={
          <>
            <StatusBadge status={exam.status} />
            {exam.status === "EVALUATED" && (
              <form action={publishExamAction}>
                <input type="hidden" name="examId" value={exam.id} />
                <button className="btn-primary">Publish results</button>
              </form>
            )}
          </>
        }
      />
      <SectionCard title={`Enter marks · ${exam.class.students.length} students · out of ${exam.maxScore}`}>
        <form action={enterMarksAction}>
          <input type="hidden" name="examId" value={exam.id} />
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Roll</th>
                <th className="th">Student</th>
                <th className="th">Score</th>
              </tr>
            </thead>
            <tbody>
              {exam.class.students.map((s) => (
                <tr key={s.id} className="row-hover">
                  <td className="td font-mono">{s.rollNo ?? "—"}</td>
                  <td className="td">{s.user.displayName}</td>
                  <td className="td">
                    <input
                      className="input w-24"
                      name={`m_${s.id}`}
                      type="number"
                      min={0}
                      max={exam.maxScore}
                      defaultValue={s.marks[0]?.score ?? ""}
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <button className="btn-secondary">Save marks</button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
