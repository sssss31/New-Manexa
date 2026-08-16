import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { dateShort } from "@/lib/format";

export default async function ExamsIndex() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const exams = await prisma.exam.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { scheduledAt: "desc" },
    include: { class: true, subject: true, marks: true },
  });
  return (
    <>
      <PageHeader title="Examinations & results" sub="Class tests, FAs, SAs, board pattern" />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Exam</th>
              <th className="th">Class</th>
              <th className="th">Subject</th>
              <th className="th">Type</th>
              <th className="th">Scheduled</th>
              <th className="th">Marks entered</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id} className="row-hover">
                <td className="td">
                  <Link href={`/teacher/exams/${e.id}`} className="text-fg font-medium hover:text-accent">
                    {e.title}
                  </Link>
                </td>
                <td className="td">{e.class.name}</td>
                <td className="td">{e.subject.name}</td>
                <td className="td text-muted">{e.type}</td>
                <td className="td text-muted">{dateShort(e.scheduledAt)}</td>
                <td className="td tabular-nums">{e.marks.length}</td>
                <td className="td"><StatusBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
