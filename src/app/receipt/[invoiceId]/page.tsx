import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inr, dateTimeShort } from "@/lib/format";
import { PrintButton } from "@/components/payments/PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const user = await requireUser();

  // Scope: same tenant; parents only their own child's invoices.
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId ?? undefined,
      ...(user.role === "PARENT" ? { student: { parents: { some: { parent: { userId: user.id } } } } } : {}),
    },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
      tenant: { select: { name: true, institutionId: true, city: true, state: true } },
      student: { include: { user: true, class: true, section: true } },
    },
  });
  if (!invoice || invoice.status !== "PAID") notFound();
  const payment = invoice.payments[0];

  return (
    <div className="min-h-screen bg-bg px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href="/parent/fees" className="btn-ghost text-sm">← Back</a>
          <div className="flex items-center gap-2">
            <PrintButton />
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" className="btn-primary text-sm">
              Download PDF
            </a>
          </div>
        </div>

        <div className="card rounded-2xl p-8 print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-border pb-5">
            <div>
              <div className="text-xl font-semibold text-fg">{invoice.tenant.name}</div>
              <div className="text-xs text-muted">
                {invoice.tenant.institutionId}
                {invoice.tenant.city ? ` · ${invoice.tenant.city}` : ""}{invoice.tenant.state ? `, ${invoice.tenant.state}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">✓ Paid</div>
              <div className="mt-1 text-xs text-muted">Receipt</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <Field k="Invoice" v={invoice.number} />
            <Field k="Period" v={invoice.periodLabel} />
            <Field k="Student" v={invoice.student.user.displayName} />
            <Field k="Class" v={`${invoice.student.class.name} ${invoice.student.section.name}`} />
            <Field k="Paid on" v={invoice.paidAt ? dateTimeShort(invoice.paidAt) : "—"} />
            <Field k="Method" v={payment?.method ?? "—"} />
            {payment?.gatewayTxId && <Field k="Transaction ID" v={payment.gatewayTxId} mono />}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-muted">
                <th className="py-2 font-medium">Particular</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="py-2 text-fg">{it.head}</td>
                  <td className="py-2 text-right tabular-nums text-fg">{inr(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-3 text-fg">Total paid</td>
                <td className="py-3 text-right tabular-nums text-accent">{inr(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-6 border-t border-border pt-4 text-center text-[11px] text-muted">
            This is a computer-generated receipt from MANEXA and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
      <div className={`text-fg ${mono ? "font-mono text-xs" : ""}`}>{v}</div>
    </div>
  );
}
