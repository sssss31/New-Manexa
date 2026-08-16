import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, EmptyState } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";
import { payInvoiceAction } from "../actions";

export default async function InvoicesPage() {
  const user = await requireRole("ACCOUNTANT");
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: user.tenantId! },
    include: {
      student: { include: { user: true, class: true, section: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Invoices" sub="Real student invoices · record full or partial offline payments directly here." />
      <SectionCard>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices available" sub="Generate invoices from a fee structure to start collecting fees." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="th">#</th>
                  <th className="th">Student</th>
                  <th className="th">Class</th>
                  <th className="th">Due</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Paid</th>
                  <th className="th text-right">Balance</th>
                  <th className="th">Status</th>
                  <th className="th">Record payment</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const paid = i.payments.reduce((s, p) => s + p.amount, 0);
                  const balance = i.total - paid;
                  const settled = balance <= 0;
                  return (
                    <tr key={i.id} className="row-hover">
                      <td className="td"><Link href={`/receipt/${i.id}`} className="font-mono text-xs text-accent hover:underline">{i.number}</Link></td>
                      <td className="td">{i.student.user.displayName}</td>
                      <td className="td text-muted">{i.student.class.name} {i.student.section.name}</td>
                      <td className="td text-muted whitespace-nowrap">{dateShort(i.dueDate)}</td>
                      <td className="td tabular-nums text-right">{inr(i.total)}</td>
                      <td className="td tabular-nums text-right text-success">{paid ? inr(paid) : "—"}</td>
                      <td className={`td tabular-nums text-right ${balance > 0 ? "text-warning" : ""}`}>{balance > 0 ? inr(balance) : "—"}</td>
                      <td className="td"><StatusBadge status={i.status} /></td>
                      <td className="td">
                        {settled ? (
                          <span className="text-xs text-muted">Settled</span>
                        ) : (
                          <form action={payInvoiceAction} className="flex flex-wrap items-center gap-1">
                            <input type="hidden" name="invoiceId" value={i.id} />
                            <input
                              name="amount" type="number" min={1} max={balance} defaultValue={balance}
                              className="input text-xs px-2 py-1 w-24 tabular-nums" aria-label="Amount" title={`Outstanding ${inr(balance)}`}
                            />
                            <select name="method" className="select text-xs px-2 py-1" aria-label="Method">
                              <option>CASH</option><option>UPI</option><option>CARD</option><option>BANK_TRANSFER</option><option>CHEQUE</option><option>OTHER</option>
                            </select>
                            <button className="btn-primary text-xs px-2 py-1">Record</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
