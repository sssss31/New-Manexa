import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { inr, relative, dateShort } from "@/lib/format";
import { generateMonthlyInvoicesAction } from "./actions";

export default async function AccountsHome() {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoices, dueAgg, collectedThisMonth, paidPayments, recentPayments, defaulters] = await Promise.all([
    prisma.invoice.count({ where: { tenantId } }),
    prisma.invoice.aggregate({
      where: { tenantId, status: { in: ["DUE", "OVERDUE"] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart }, invoice: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { invoice: { tenantId } } }),
    prisma.payment.findMany({
      where: { invoice: { tenantId } },
      include: { invoice: { include: { student: { include: { user: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 6,
    }),
    prisma.invoice.findMany({
      where: { tenantId, status: { in: ["DUE", "OVERDUE"] }, dueDate: { lt: now } },
      include: { student: { include: { user: true, class: true, section: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Finance cockpit"
        sub="Collections · reconciliation · defaulters · payroll"
        actions={
          <form action={generateMonthlyInvoicesAction}>
            <button className="btn-primary">+ Generate this month&apos;s invoices</button>
          </form>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Invoices" value={invoices.toLocaleString()} />
        <Stat label="Outstanding" value={inr(dueAgg._sum.total ?? 0)} tone="error" sub={`${dueAgg._count} invoices`} />
        <Stat label="Collected · this month" value={inr(collectedThisMonth._sum.amount ?? 0)} tone="success" />
        <Stat label="Payments (all-time)" value={paidPayments.toLocaleString()} tone="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Recent payments">
          {recentPayments.length === 0 && <div className="text-sm text-muted">No payments recorded yet.</div>}
          <table className="w-full">
            <thead><tr><th className="th">Student</th><th className="th">Method</th><th className="th">Amount</th><th className="th">When</th></tr></thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id} className="row-hover">
                  <td className="td">{p.invoice.student.user.displayName}<div className="text-xs text-muted font-mono">{p.invoice.number}</div></td>
                  <td className="td">{p.method}</td>
                  <td className="td tabular-nums">{inr(p.amount)}</td>
                  <td className="td text-xs text-muted">{relative(p.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Top defaulters">
          {defaulters.length === 0 && <div className="text-sm text-muted">No dues past their date. 🎉</div>}
          <table className="w-full">
            <thead><tr><th className="th">Student</th><th className="th">Class</th><th className="th">Amount</th><th className="th">Due</th><th className="th">Status</th></tr></thead>
            <tbody>
              {defaulters.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td">{i.student.user.displayName}</td>
                  <td className="td text-muted">{i.student.class.name} {i.student.section.name}</td>
                  <td className="td tabular-nums">{inr(i.total)}</td>
                  <td className="td text-muted">{dateShort(i.dueDate)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </>
  );
}
