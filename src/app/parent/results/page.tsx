import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { dateShort } from "@/lib/format";

export default async function ParentResults() {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  const kid = kids[0];
  if (!kid) return <EmptyState title="No child linked" />;
  const marks = await prisma.mark.findMany({
    where: { studentId: kid.id, exam: { status: "PUBLISHED" } },
    include: { exam: { include: { subject: true } } },
    orderBy: { createdAt: "desc" },
  });
  const avg = marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
  return (
    <>
      <PageHeader title="Published results" sub={kid.user.displayName} />
      <div className="mb-6 flex justify-end">
        <Link href={`/report-card/${kid.id}`} className="btn-primary text-sm">View report card →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Results out" value={marks.length} />
        <Stat label="Average score" value={`${avg}`} tone={avg >= 60 ? "success" : "warning"} sub="/ 100" />
        <Stat label="Best" value={marks.length ? Math.max(...marks.map((m) => m.score)) : "—"} tone="accent" sub="/ 100" />
        <Stat label="Weakest" value={marks.length ? Math.min(...marks.map((m) => m.score)) : "—"} sub="/ 100" />
      </div>
      <SectionCard>
        <table className="w-full">
          <thead><tr><th className="th">Exam</th><th className="th">Type</th><th className="th">Subject</th><th className="th">Date</th><th className="th">Score</th><th className="th">Status</th></tr></thead>
          <tbody>
            {marks.map((m) => (
              <tr key={m.id} className="row-hover">
                <td className="td">{m.exam.title}</td>
                <td className="td text-muted">{m.exam.type}</td>
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
