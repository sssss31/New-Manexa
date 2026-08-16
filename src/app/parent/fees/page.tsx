import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { inr, dateShort } from "@/lib/format";
import { razorpayEnabled } from "@/lib/payments/razorpay";
import { RazorpayPayButton } from "@/components/payments/RazorpayPayButton";
import { payInvoiceAsParent } from "../actions";

export default async function ParentFees({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  if (kids.length === 0) return <EmptyState title="No child linked" sub="Ask your institution to link your child to your account." />;

  const { child } = await searchParams;
  // Only children that actually belong to this parent are selectable (kids list
  // is already parent-scoped) — a spoofed ?child= id falls back to the first.
  const kid = kids.find((k) => k.id === child) ?? kids[0];

  const invoices = await prisma.invoice.findMany({
    where: { studentId: kid.id },
    include: { items: true, payments: { select: { amount: true, paidAt: true, method: true } } },
    orderBy: { issueDate: "desc" },
  });
  const withBalance = invoices.map((i) => {
    const paid = i.payments.reduce((s, p) => s + p.amount, 0);
    return { ...i, paid, balance: i.total - paid };
  });
  const open = withBalance.filter((i) => i.balance > 0 && i.status !== "CANCELLED");
  const settled = withBalance.filter((i) => i.balance <= 0);
  const totalOutstanding = open.reduce((s, i) => s + i.balance, 0);
  const totalPaid = withBalance.reduce((s, i) => s + i.paid, 0);
  const online = razorpayEnabled();

  return (
    <>
      <PageHeader title="Fees & payments" sub={`${kid.user.displayName} · ${kid.class.name} ${kid.section.name}`} />

      {/* Multi-child switcher — sibling records stay separate (§8). */}
      {kids.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Children">
          {kids.map((k) => (
            <Link
              key={k.id}
              href={`/parent/fees?child=${k.id}`}
              aria-selected={k.id === kid.id}
              className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${k.id === kid.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:text-fg"}`}
            >
              {k.user.displayName} · {k.class.name} {k.section.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Outstanding" value={inr(totalOutstanding)} tone={totalOutstanding ? "error" : "success"} />
        <Stat label="Paid till date" value={inr(totalPaid)} tone="success" />
        <Stat label="Open invoices" value={open.length} />
        <Stat label="Settled invoices" value={settled.length} />
      </div>

      <SectionCard title="Open invoices">
        {open.length === 0 ? (
          <div className="text-sm text-muted">All caught up. 🎉</div>
        ) : (
          <div className="space-y-3">
            {open.map((i) => (
              <div key={i.id} className="border border-border rounded-lg p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-fg font-medium">{i.periodLabel}</div>
                    <div className="text-xs text-muted font-mono">{i.number} · due {dateShort(i.dueDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-fg">{inr(i.balance)}</div>
                    <div className="text-xs text-muted">of {inr(i.total)}{i.paid ? ` · ${inr(i.paid)} paid` : ""}</div>
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
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Link href={`/receipt/${i.id}`} className="btn-ghost text-sm">View invoice</Link>
                  {online ? (
                    <RazorpayPayButton
                      invoiceId={i.id}
                      amountLabel={inr(i.balance)}
                      prefillEmail={user.email}
                      prefillContact={user.phone ?? undefined}
                      className="btn-primary text-sm"
                    />
                  ) : (
                    // No live gateway configured — record the payment offline.
                    // Amount defaults to the full balance; a smaller value is a partial payment.
                    <form action={payInvoiceAsParent} className="flex items-center gap-2">
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <input name="amount" type="number" min={1} max={i.balance} defaultValue={i.balance} className="input w-28 text-sm tabular-nums" aria-label="Amount" />
                      <select name="method" className="select w-28 text-xs" aria-label="Method">
                        <option value="UPI">UPI</option><option value="CARD">Card</option><option value="NETBANKING">Net-banking</option>
                      </select>
                      <button className="btn-primary text-sm">Pay</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Payment history" className="mt-4">
        {settled.length === 0 && withBalance.every((i) => i.paid === 0) ? (
          <div className="text-sm text-muted">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th">#</th><th className="th">Period</th><th className="th text-right">Total</th><th className="th text-right">Paid</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th">Receipt</th></tr></thead>
              <tbody>
                {withBalance.filter((i) => i.paid > 0).map((p) => (
                  <tr key={p.id} className="row-hover">
                    <td className="td font-mono text-xs">{p.number}</td>
                    <td className="td">{p.periodLabel}</td>
                    <td className="td tabular-nums text-right">{inr(p.total)}</td>
                    <td className="td tabular-nums text-right text-success">{inr(p.paid)}</td>
                    <td className="td tabular-nums text-right">{p.balance > 0 ? inr(p.balance) : "—"}</td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                    <td className="td"><Link href={`/receipt/${p.id}`} className="text-accent text-xs hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
