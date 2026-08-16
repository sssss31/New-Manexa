import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inr, dateTimeShort, dateShort } from "@/lib/format";
import { PrintButton } from "@/components/payments/PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const user = await requireUser();

  // Scope: same tenant; parents only their own child's invoices (§20 — the ID in
  // the URL can never be used to read another family's or tenant's invoice).
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId ?? undefined,
      ...(user.role === "PARENT" ? { student: { parents: { some: { parent: { userId: user.id } } } } } : {}),
    },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
      tenant: { select: { name: true, institutionId: true, city: true, state: true, phone: true, email: true } },
      student: {
        include: {
          user: true, class: true, section: true,
          parents: { orderBy: { isPrimary: "desc" }, include: { parent: { include: { user: true } } } },
        },
      },
    },
  });
  if (!invoice) notFound();

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.total - paid;
  const parent = invoice.student.parents[0]?.parent.user;
  const isPaid = invoice.status === "PAID";
  const label = isPaid ? "Receipt" : "Invoice";

  return (
    <div className="min-h-screen bg-bg px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href={user.role === "PARENT" ? "/parent/fees" : "/accounts/invoices"} className="btn-ghost text-sm">← Back</a>
          <PrintButton />
        </div>

        <div className="card rounded-2xl p-8 print:border-0 print:shadow-none">
          {/* Institution header */}
          <div className="flex items-start justify-between border-b border-border pb-5">
            <div>
              <div className="text-xl font-semibold text-fg">{invoice.tenant.name}</div>
              <div className="text-xs text-muted">
                {invoice.tenant.institutionId}
                {invoice.tenant.city ? ` · ${invoice.tenant.city}` : ""}{invoice.tenant.state ? `, ${invoice.tenant.state}` : ""}
              </div>
              {(invoice.tenant.phone || invoice.tenant.email) && (
                <div className="text-xs text-muted">{[invoice.tenant.phone, invoice.tenant.email].filter(Boolean).join(" · ")}</div>
              )}
            </div>
            <div className="text-right">
              <StatusPill status={invoice.status} />
              <div className="mt-1 text-xs text-muted">{label}</div>
            </div>
          </div>

          {/* Billed-to (parent) + student (§2) */}
          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Billed to</div>
              <div className="text-fg font-medium">{parent?.displayName ?? "—"}</div>
              {parent?.manexaId && <div className="text-xs font-mono text-muted">{parent.manexaId}</div>}
              {parent?.email && <div className="text-xs text-muted">{parent.email}</div>}
              {parent?.phone && <div className="text-xs text-muted">{parent.phone}</div>}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">For student</div>
              <div className="text-fg font-medium">{invoice.student.user.displayName}</div>
              {invoice.student.user.manexaId && <div className="text-xs font-mono text-muted">{invoice.student.user.manexaId}</div>}
              <div className="text-xs text-muted">{invoice.student.class.name} {invoice.student.section.name} · Roll {invoice.student.rollNo ?? "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 text-sm">
            <Field k="Invoice" v={invoice.number} mono />
            <Field k="Period" v={invoice.periodLabel} />
            <Field k="Issued" v={dateShort(invoice.issueDate)} />
            <Field k="Due" v={dateShort(invoice.dueDate)} />
          </div>

          {/* Fee breakdown (§4) */}
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
            <tfoot className="text-sm">
              <tr><td className="pt-3 text-muted">Subtotal</td><td className="pt-3 text-right tabular-nums text-fg">{inr(invoice.subtotal)}</td></tr>
              {invoice.discount > 0 && <tr><td className="py-1 text-muted">Concession</td><td className="py-1 text-right tabular-nums text-success">-{inr(invoice.discount)}</td></tr>}
              {invoice.lateFee > 0 && <tr><td className="py-1 text-muted">Late fee</td><td className="py-1 text-right tabular-nums text-warning">{inr(invoice.lateFee)}</td></tr>}
              <tr className="font-semibold"><td className="py-1 text-fg border-t border-border">Total</td><td className="py-1 text-right tabular-nums text-fg border-t border-border">{inr(invoice.total)}</td></tr>
              <tr><td className="py-1 text-muted">Paid</td><td className="py-1 text-right tabular-nums text-success">{inr(paid)}</td></tr>
              <tr className="font-semibold"><td className="py-2 text-fg">Balance</td><td className={`py-2 text-right tabular-nums ${balance > 0 ? "text-warning" : "text-accent"}`}>{inr(balance)}</td></tr>
            </tfoot>
          </table>

          {/* Payment history */}
          {invoice.payments.length > 0 && (
            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Payments</div>
              <table className="w-full text-sm">
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 text-muted">{p.paidAt ? dateTimeShort(p.paidAt) : "—"}</td>
                      <td className="py-1.5 text-fg">{p.method}</td>
                      <td className="py-1.5 font-mono text-xs text-subtle">{p.gatewayTxId ?? p.reference}</td>
                      <td className="py-1.5 text-right tabular-nums text-fg">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-6 border-t border-border pt-4 text-center text-[11px] text-muted">
            This is a computer-generated {label.toLowerCase()} from MANEXA and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const paid = status === "PAID";
  const partial = status === "PARTIALLY_PAID";
  const cls = paid ? "bg-success/15 text-success" : partial ? "bg-warning/15 text-warning" : "bg-elevated text-muted";
  return <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{paid ? "✓ Paid" : partial ? "Partially paid" : status}</div>;
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
      <div className={`text-fg ${mono ? "font-mono text-xs" : ""}`}>{v}</div>
    </div>
  );
}
