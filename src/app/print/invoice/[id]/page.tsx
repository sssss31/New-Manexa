import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { findInvoiceForViewer } from "@/lib/invoices";
import { effectiveStatus } from "@/lib/invoice-pdf";
import { inr, dateShort, dateTimeShort } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/payments/PrintButton";

// Print-ready invoice (any status — the receipt page only covers PAID).
// Same document the PDF endpoint renders, as themable HTML with print CSS.
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const invoice = await findInvoiceForViewer(user, id);
  if (!invoice) notFound();

  const status = effectiveStatus(invoice);
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const place = [invoice.tenant.city, invoice.tenant.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-bg px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="no-print mb-4 flex items-center justify-between">
          <PrintButton />
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" className="btn-primary text-sm">
            Download PDF
          </a>
        </div>

        <div className="card rounded-2xl p-8 print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-border pb-5">
            <div>
              <div className="text-xl font-semibold text-fg">{invoice.tenant.name}</div>
              <div className="text-xs text-muted">
                {invoice.tenant.institutionId}
                {place ? ` · ${place}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-semibold tracking-tight text-muted">INVOICE</div>
              <div className="font-mono text-xs text-fg">{invoice.number}</div>
              <div className="mt-1.5"><StatusBadge status={status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Billed to</div>
              <div className="font-medium text-fg">{invoice.student.user.displayName}</div>
              <div className="text-xs text-muted">
                Class {invoice.student.class.name} · Section {invoice.student.section.name}
              </div>
              <div className="text-xs text-muted">Admission No: {invoice.student.admissionNo}</div>
            </div>
            <div className="space-y-1 text-right text-xs">
              <MetaRow k="Period" v={invoice.periodLabel} />
              <MetaRow k="Issue date" v={dateShort(invoice.issueDate)} />
              <MetaRow k="Due date" v={dateShort(invoice.dueDate)} />
              {invoice.paidAt && <MetaRow k="Paid on" v={dateShort(invoice.paidAt)} />}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-muted">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">Particulars</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="py-2 w-8 text-muted">{i + 1}</td>
                  <td className="py-2 text-fg">{it.head}</td>
                  <td className="py-2 text-right tabular-nums text-fg">{inr(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
            <TotalRow k="Subtotal" v={inr(invoice.subtotal)} />
            {invoice.discount > 0 && <TotalRow k="Discount" v={`- ${inr(invoice.discount)}`} tone="text-success" />}
            {invoice.lateFee > 0 && <TotalRow k="Late fee" v={inr(invoice.lateFee)} tone="text-error" />}
            <div className="border-t border-border pt-1.5">
              <TotalRow k="Total" v={inr(invoice.total)} bold />
            </div>
            <TotalRow k="Amount paid" v={inr(paid)} tone={paid > 0 ? "text-success" : undefined} />
            <TotalRow k="Balance due" v={inr(balance)} bold tone={balance > 0 ? "text-error" : "text-success"} />
          </div>

          {invoice.payments.length > 0 && (
            <div className="mt-6">
              <div className="border-b border-border pb-1 text-[11px] uppercase tracking-wider text-muted">Payments</div>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-1.5 text-fg">{dateTimeShort(p.paidAt)}</td>
                      <td className="py-1.5 text-muted">{p.method}</td>
                      <td className="py-1.5 font-mono text-[11px] text-muted">{p.gatewayTxId ?? p.reference}</td>
                      <td className="py-1.5 text-right tabular-nums text-fg">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-6 border-t border-border pt-4 text-center text-[11px] text-muted">
            Computer-generated invoice · No signature required · Powered by MANEXA
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-end gap-3">
      <span className="text-muted">{k}</span>
      <span className="w-24 text-fg">{v}</span>
    </div>
  );
}

function TotalRow({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted">{k}</span>
      <span className={`tabular-nums ${tone ?? "text-fg"}`}>{v}</span>
    </div>
  );
}
