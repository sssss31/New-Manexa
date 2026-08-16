import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag, StatusBadge, EmptyState } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";
import { VENDOR_CATEGORIES } from "@/lib/ops";
import { createVendorAction, createPurchaseOrderAction, setPoStatusAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const sp = await searchParams;

  const [vendors, orders] = await Promise.all([
    prisma.vendor.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    prisma.purchaseOrder.findMany({ where: { tenantId }, include: { vendor: true }, orderBy: { orderedAt: "desc" }, take: 50 }),
  ]);
  const pendingValue = orders.filter((o) => o.status === "DRAFT" || o.status === "APPROVED").reduce((s, o) => s + o.amount, 0);
  const receivedValue = orders.filter((o) => o.status === "RECEIVED").reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageHeader title="Procurement" sub="Vendors & purchase orders" />
      {sp.err && <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error" role="alert">{decodeURIComponent(sp.err)}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Vendors" value={vendors.length} />
        <Stat label="Purchase orders" value={orders.length} />
        <Stat label="Open PO value" value={inr(pendingValue)} tone="warning" />
        <Stat label="Received value" value={inr(receivedValue)} tone="success" />
      </div>

      {/* Create PO */}
      <SectionCard className="mb-4">
        <div className="text-sm font-semibold text-fg mb-3">New purchase order</div>
        {vendors.length === 0 ? (
          <div className="text-sm text-muted">Add a vendor first to raise a purchase order.</div>
        ) : (
          <form action={createPurchaseOrderAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label>
              <span className="label">Vendor</span>
              <select name="vendorId" className="select" required>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className="label">Description</span>
              <input name="description" required placeholder="e.g. 30 lab desktops" className="input" />
            </label>
            <label>
              <span className="label">Amount (₹)</span>
              <input name="amount" required inputMode="numeric" placeholder="0" className="input" />
            </label>
            <div className="lg:col-span-4">
              <button className="btn-primary">Raise PO</button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* PO list */}
      <SectionCard className="mb-6">
        <div className="text-sm font-semibold text-fg mb-1">Purchase orders</div>
        {orders.length === 0 ? (
          <EmptyState title="No purchase orders yet" sub="Raise your first PO above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">PO #</th><th className="th">Vendor</th><th className="th">Description</th>
                <th className="th text-right">Amount</th><th className="th">Status</th><th className="th">Ordered</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="row-hover">
                    <td className="td font-mono text-xs text-muted">{o.number}</td>
                    <td className="td text-fg">{o.vendor.name}</td>
                    <td className="td text-muted">{o.description}</td>
                    <td className="td text-right tabular-nums font-semibold">{inr(o.amount)}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                    <td className="td text-muted whitespace-nowrap">{dateShort(o.orderedAt)}</td>
                    <td className="td text-right whitespace-nowrap">
                      {o.status === "DRAFT" && <StatusForm id={o.id} to="APPROVED" label="Approve" cls="btn-secondary" />}
                      {o.status === "APPROVED" && <StatusForm id={o.id} to="RECEIVED" label="Mark received" cls="btn-secondary" />}
                      {(o.status === "DRAFT" || o.status === "APPROVED") && <StatusForm id={o.id} to="CANCELLED" label="Cancel" cls="btn-ghost text-error" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add vendor + vendor list */}
      <SectionCard>
        <div className="text-sm font-semibold text-fg mb-3">Add vendor</div>
        <form action={createVendorAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-5">
          <label><span className="label">Name</span><input name="name" required placeholder="Vendor name" className="input" /></label>
          <label><span className="label">Category</span>
            <select name="category" className="select" defaultValue="GENERAL">
              {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label><span className="label">Phone</span><input name="phone" placeholder="Optional" className="input" /></label>
          <label><span className="label">GSTIN</span><input name="gstin" placeholder="Optional" className="input" /></label>
          <div className="lg:col-span-4"><button className="btn-secondary">Add vendor</button></div>
        </form>
        {vendors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 py-1.5 text-sm">
                <span className="text-fg">{v.name}</span><Tag>{v.category.charAt(0) + v.category.slice(1).toLowerCase()}</Tag>
              </span>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function StatusForm({ id, to, label, cls }: { id: string; to: string; label: string; cls: string }) {
  return (
    <form action={setPoStatusAction} className="inline-block ml-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <button className={`${cls} text-xs`}>{label}</button>
    </form>
  );
}
