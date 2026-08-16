import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";

export default async function CollectionsPage() {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;
  const [payments, byMethod, ytd] = await Promise.all([
    prisma.payment.findMany({
      where: { invoice: { tenantId } },
      include: { invoice: { include: { student: { include: { user: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { invoice: { tenantId } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: {
        invoice: { tenantId },
        paidAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
      _sum: { amount: true },
    }),
  ]);
  return (
    <>
      <PageHeader title="Collections" sub="Gateway-wise reconciliation and cash flow" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="YTD" value={inr(ytd._sum.amount ?? 0)} tone="success" />
        {byMethod.map((m) => (
          <Stat key={m.method} label={m.method} value={inr(m._sum.amount ?? 0)} sub={`${m._count} txns`} />
        ))}
      </div>

      <SectionCard title={`Recent payments · ${payments.length}`}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">When</th>
              <th className="th">Student</th>
              <th className="th">Invoice</th>
              <th className="th">Method</th>
              <th className="th">Reference</th>
              <th className="th">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="row-hover">
                <td className="td text-muted">{dateShort(p.paidAt)}</td>
                <td className="td">{p.invoice.student.user.displayName}</td>
                <td className="td font-mono text-xs">{p.invoice.number}</td>
                <td className="td">{p.method}</td>
                <td className="td font-mono text-xs text-muted">{p.reference}</td>
                <td className="td tabular-nums">{inr(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
