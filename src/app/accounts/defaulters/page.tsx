import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { dateShort, inr } from "@/lib/format";

function bucket(days: number) {
  if (days <= 30) return { label: "1-30 days", tone: "warning" as const };
  if (days <= 60) return { label: "31-60 days", tone: "warning" as const };
  return { label: "60+ days", tone: "warning" as const };
}

export default async function DefaultersPage() {
  const user = await requireRole("ACCOUNTANT");
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: user.tenantId!, status: { in: ["DUE", "OVERDUE"] }, dueDate: { lt: new Date() } },
    include: { student: { include: { user: true, class: true, section: true, parents: { include: { parent: { include: { user: true } } } } } } },
    orderBy: { dueDate: "asc" },
  });
  return (
    <>
      <PageHeader title="Defaulters" sub={`${invoices.length} overdue invoices — send reminder from Communication`} />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Invoice</th>
              <th className="th">Student</th>
              <th className="th">Class</th>
              <th className="th">Parent</th>
              <th className="th">Bucket</th>
              <th className="th">Amount</th>
              <th className="th">Due</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const days = Math.floor((Date.now() - i.dueDate.getTime()) / 86400000);
              const b = bucket(days);
              return (
                <tr key={i.id} className="row-hover">
                  <td className="td font-mono text-xs">{i.number}</td>
                  <td className="td">{i.student.user.displayName}</td>
                  <td className="td text-muted">{i.student.class.name} {i.student.section.name}</td>
                  <td className="td text-muted">
                    {i.student.parents[0]?.parent.user.displayName ?? "—"}
                    <div className="text-xs">{i.student.parents[0]?.parent.user.phone ?? "—"}</div>
                  </td>
                  <td className="td"><Tag tone={b.tone}>{b.label}</Tag></td>
                  <td className="td tabular-nums">{inr(i.total)}</td>
                  <td className="td text-muted">{dateShort(i.dueDate)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
