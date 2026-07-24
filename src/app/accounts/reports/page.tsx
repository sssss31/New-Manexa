import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat } from "@/components/ui";
import { inr } from "@/lib/format";

export default async function AccountsReports() {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [byHead, byStatus, currMonth, prevPayments] = await Promise.all([
    prisma.invoiceItem.groupBy({
      by: ["head"],
      where: { invoice: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: { invoice: { tenantId }, paidAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: {
        invoice: { tenantId },
        paidAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: monthStart,
        },
      },
      _sum: { amount: true },
    }),
  ]);
  const prevAmt = prevPayments._sum.amount ?? 0;
  const currAmt = currMonth._sum.amount ?? 0;
  const delta = prevAmt ? Math.round(((currAmt - prevAmt) / prevAmt) * 100) : 0;
  return (
    <>
      <PageHeader title="Reports" sub="MIS · head-wise · month-on-month" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="This month" value={inr(currAmt)} tone="success" />
        <Stat label="Last month" value={inr(prevAmt)} />
        <Stat label="MoM change" value={`${delta > 0 ? "+" : ""}${delta}%`} tone={delta >= 0 ? "success" : "error"} />
        <Stat label="Transactions" value={currMonth._count} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Revenue by head">
          <table className="w-full">
            <thead><tr><th className="th">Head</th><th className="th">Amount</th></tr></thead>
            <tbody>
              {byHead.map((h) => (
                <tr key={h.head} className="row-hover">
                  <td className="td">{h.head}</td>
                  <td className="td tabular-nums">{inr(h._sum.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Invoices by status">
          <table className="w-full">
            <thead><tr><th className="th">Status</th><th className="th">Count</th><th className="th">Value</th></tr></thead>
            <tbody>
              {byStatus.map((s) => (
                <tr key={s.status} className="row-hover">
                  <td className="td">{s.status}</td>
                  <td className="td tabular-nums">{s._count}</td>
                  <td className="td tabular-nums">{inr(s._sum.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </>
  );
}
