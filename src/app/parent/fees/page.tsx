import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { inr, dateShort } from "@/lib/format";
import { payInvoiceAsParent } from "../actions";

export default async function ParentFees() {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  const kid = kids[0];
  if (!kid) return <EmptyState title="No child linked" />;
  const invoices = await prisma.invoice.findMany({
    where: { studentId: kid.id },
    include: { items: true },
    orderBy: { issueDate: "desc" },
  });
  const due = invoices.filter((i) => i.status !== "PAID");
  const paid = invoices.filter((i) => i.status === "PAID");
  const totalDue = due.reduce((s, i) => s + i.total, 0);
  const totalPaid = paid.reduce((s, i) => s + i.total, 0);
  return (
    <>
      <PageHeader title="Fees & payments" sub={kid.user.displayName} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Outstanding" value={inr(totalDue)} tone={totalDue ? "error" : "success"} />
        <Stat label="Paid till date" value={inr(totalPaid)} tone="success" />
        <Stat label="Open invoices" value={due.length} />
        <Stat label="Paid invoices" value={paid.length} />
      </div>

      <SectionCard title="Open invoices">
        {due.length === 0 && <div className="text-sm text-muted">All caught up. 🎉</div>}
        <div className="space-y-3">
          {due.map((i) => (
            <div key={i.id} className="border border-border rounded-lg p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-fg font-medium">{i.periodLabel}</div>
                  <div className="text-xs text-muted font-mono">{i.number} · due {dateShort(i.dueDate)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-fg">{inr(i.total)}</div>
                  <StatusBadge status={i.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs text-muted">
                {i.items.map((it) => (
                  <div key={it.id} className="flex justify-between border border-border rounded p-1.5">
                    <span>{it.head}</span>
                    <span className="tabular-nums text-fg">{inr(it.amount)}</span>
                  </div>
                ))}
              </div>
              <form action={payInvoiceAsParent} className="mt-3 flex gap-2 justify-end">
                <input type="hidden" name="invoiceId" value={i.id} />
                <select name="method" className="select w-32 text-xs">
                  <option value="UPI">UPI</option><option value="CARD">Card</option><option value="NETBANKING">Net-banking</option>
                </select>
                <button className="btn-primary text-sm">Pay {inr(i.total)}</button>
              </form>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Payment history" className="mt-4">
        {paid.length === 0 && <div className="text-sm text-muted">No payments yet.</div>}
        <table className="w-full">
          <thead><tr><th className="th">#</th><th className="th">Period</th><th className="th">Amount</th><th className="th">Paid on</th></tr></thead>
          <tbody>
            {paid.map((p) => (
              <tr key={p.id} className="row-hover">
                <td className="td font-mono text-xs">{p.number}</td>
                <td className="td">{p.periodLabel}</td>
                <td className="td tabular-nums">{inr(p.total)}</td>
                <td className="td text-muted">{p.paidAt ? dateShort(p.paidAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
