import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { dateShort } from "@/lib/format";

export default async function StudentResults() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!student) return <EmptyState title="Not enrolled" />;
  const marks = await prisma.mark.findMany({
    where: { studentId: student.id, exam: { status: "PUBLISHED" } },
    include: { exam: { include: { subject: true } } },
    orderBy: { createdAt: "desc" },
  });
  const avg = marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
  return (
    <>
      <PageHeader title="My results" sub="Published exams only" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Published" value={marks.length} />
        <Stat label="Average" value={`${avg}`} sub="/ 100" tone={avg >= 60 ? "success" : "warning"} />
        <Stat label="Highest" value={marks.length ? Math.max(...marks.map((m) => m.score)) : "—"} tone="accent" />
        <Stat label="Lowest" value={marks.length ? Math.min(...marks.map((m) => m.score)) : "—"} />
      </div>
      <SectionCard>
        <table className="w-full">
          <thead><tr><th className="th">Exam</th><th className="th">Subject</th><th className="th">Date</th><th className="th">Score</th><th className="th">Status</th></tr></thead>
          <tbody>
            {marks.map((m) => (
              <tr key={m.id} className="row-hover">
                <td className="td">{m.exam.title}</td>
                <td className="td">{m.exam.subject.name}</td>
                <td className="td text-muted">{dateShort(m.exam.scheduledAt)}</td>
                <td className="td tabular-nums font-semibold">{m.score} / {m.exam.maxScore}</td>
                <td className="td"><StatusBadge status={m.exam.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
