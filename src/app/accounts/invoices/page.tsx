import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";
import { payInvoiceAction } from "../actions";

export default async function InvoicesPage() {
  const user = await requireRole("ACCOUNTANT");
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: user.tenantId! },
    include: { student: { include: { user: true, class: true, section: true } }, items: true },
    orderBy: { issueDate: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Invoices" sub="All raised invoices · pay offline (cash/cheque/UPI) directly from here" />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">#</th>
              <th className="th">Student</th>
              <th className="th">Class</th>
              <th className="th">Period</th>
              <th className="th">Due</th>
              <th className="th">Amount</th>
              <th className="th">Status</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="row-hover">
                <td className="td font-mono text-xs">{i.number}</td>
                <td className="td">{i.student.user.displayName}</td>
                <td className="td text-muted">{i.student.class.name} {i.student.section.name}</td>
                <td className="td">{i.periodLabel}</td>
                <td className="td text-muted">{dateShort(i.dueDate)}</td>
                <td className="td tabular-nums">{inr(i.total)}</td>
                <td className="td"><StatusBadge status={i.status} /></td>
                <td className="td">
                  {i.status !== "PAID" && (
                    <form action={payInvoiceAction} className="flex gap-1">
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <select name="method" className="select text-xs px-2 py-1">
                        <option>UPI</option><option>CASH</option><option>CARD</option><option>NETBANKING</option><option>CHEQUE</option>
                      </select>
                      <button className="btn-primary text-xs px-2 py-1">Mark paid</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
