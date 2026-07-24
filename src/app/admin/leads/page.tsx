import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function GlobalLeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Global leads" sub="Cross-tenant view of pipeline health" />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Prospect</th>
              <th className="th">Tenant</th>
              <th className="th">Grade</th>
              <th className="th">Source</th>
              <th className="th">Score</th>
              <th className="th">Stage</th>
              <th className="th">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="row-hover">
                <td className="td">
                  <div className="font-medium text-fg">{l.studentName}</div>
                  <div className="text-xs text-muted">{l.parentName} · {l.phone}</div>
                </td>
                <td className="td text-muted">{l.tenant.name}</td>
                <td className="td">{l.gradeInterest}</td>
                <td className="td"><Tag>{l.source}</Tag></td>
                <td className="td tabular-nums">{l.score}</td>
                <td className="td"><StatusBadge status={l.stage} /></td>
                <td className="td text-xs text-muted">{relative(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
