import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag } from "@/components/ui";
import { inr, relative } from "@/lib/format";
import { adjustStockAction, createInventoryItemAction } from "../actions";

export default async function InventoryPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { item: { tenantId } },
      include: { item: true },
      orderBy: { at: "desc" },
      take: 10,
    }),
  ]);
  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel);
  const stockValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <>
      <PageHeader title="Inventory & assets" sub="Consumables with reorder alerts · procurement workflow lands in Phase 3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Items" value={items.length} />
        <Stat label="Stock value" value={inr(stockValue)} tone="accent" />
        <Stat label="Low stock" value={lowStock.length} tone={lowStock.length ? "warning" : "success"} />
        <Stat label="Movements (recent)" value={movements.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Stock" className="lg:col-span-2">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">Item</th>
                  <th className="th">Category</th>
                  <th className="th">Qty</th>
                  <th className="th">Reorder at</th>
                  <th className="th">Unit cost</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="row-hover">
                    <td className="td font-medium">{i.name}</td>
                    <td className="td text-muted">{i.category ?? "—"}</td>
                    <td className="td tabular-nums">{i.quantity}</td>
                    <td className="td tabular-nums text-muted">{i.reorderLevel}</td>
                    <td className="td tabular-nums">{inr(i.unitCost)}</td>
                    <td className="td">
                      {i.quantity <= i.reorderLevel
                        ? <Tag tone="warning">Reorder</Tag>
                        : <Tag tone="success">OK</Tag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Adjust stock">
            <form action={adjustStockAction} className="space-y-3">
              <div>
                <label className="label">Item</label>
                <select className="select" name="itemId" required>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Δ Quantity (±)</label><input className="input" name="delta" type="number" required placeholder="-5 or 20" /></div>
                <div><label className="label">Reason</label><input className="input" name="reason" placeholder="issued to lab" required /></div>
              </div>
              <button className="btn-primary w-full">Record movement</button>
            </form>
          </SectionCard>

          <SectionCard title="Add item">
            <form action={createInventoryItemAction} className="space-y-3">
              <div><label className="label">Name</label><input className="input" name="name" required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Category</label><input className="input" name="category" placeholder="Lab / Sports / Office" /></div>
                <div><label className="label">Unit cost (₹)</label><input className="input" name="unitCost" type="number" defaultValue={0} /></div>
                <div><label className="label">Opening qty</label><input className="input" name="quantity" type="number" defaultValue={0} /></div>
                <div><label className="label">Reorder level</label><input className="input" name="reorderLevel" type="number" defaultValue={5} /></div>
              </div>
              <button className="btn-secondary w-full">Add item</button>
            </form>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Recent movements" className="mt-4">
        {movements.length === 0 && <div className="text-sm text-muted">No stock movements yet.</div>}
        <ul className="space-y-2">
          {movements.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between border-b border-border pb-1.5 last:border-0">
              <span className="text-sm text-fg">
                <span className={m.delta > 0 ? "text-success" : "text-warning"}>{m.delta > 0 ? "+" : ""}{m.delta}</span>
                {" "}· {m.item.name} <span className="text-muted">— {m.reason}</span>
              </span>
              <span className="text-xs text-muted">{relative(m.at)}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
