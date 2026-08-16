import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag, EmptyState } from "@/components/ui";
import { DonutChart } from "@/components/Charts";
import { inr, dateShort } from "@/lib/format";
import { financeOverview, EXPENSE_CATEGORIES, PAID_VIA } from "@/lib/finance";
import { createExpenseAction, deleteExpenseAction } from "./actions";

export const dynamic = "force-dynamic";

function todayValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; err?: string }>;
}) {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;
  const sp = await searchParams;

  const [fin, expenses] = await Promise.all([
    financeOverview(tenantId),
    prisma.expense.findMany({ where: { tenantId }, orderBy: { spentAt: "desc" }, take: 50 }),
  ]);

  const donut = fin.byCategory.map((c) => ({ label: c.category.charAt(0) + c.category.slice(1).toLowerCase(), value: Math.round(c.amount / 1000) }));
  const netMonthPositive = fin.net.month >= 0;

  return (
    <>
      <PageHeader title="Accounting" sub="Income, expenses & live profit / loss" />

      {sp.notice && <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success" role="status">{decodeURIComponent(sp.notice)}</div>}
      {sp.err && <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error" role="alert">{decodeURIComponent(sp.err)}</div>}

      {/* P&L headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Income · month" value={inr(fin.income.month)} tone="success" />
        <Stat label="Expenses · month" value={inr(fin.expense.month)} tone="error" />
        <Stat label="Net · month" value={inr(fin.net.month)} sub={netMonthPositive ? "Surplus" : "Deficit"} tone={netMonthPositive ? "success" : "error"} />
        <Stat label="Net · all time" value={inr(fin.net.total)} tone={fin.net.total >= 0 ? "success" : "error"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* P&L trend */}
        <SectionCard className="lg:col-span-2">
          <div className="text-sm font-semibold text-fg mb-3">Profit &amp; loss · last 6 months</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-subtle border-b border-border">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 px-3 font-medium text-right">Income</th>
                  <th className="py-2 px-3 font-medium text-right">Expense</th>
                  <th className="py-2 pl-3 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {fin.monthly.map((m) => (
                  <tr key={m.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 text-fg">{m.label}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-success">{inr(m.income)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-error">{inr(m.expense)}</td>
                    <td className={`py-2.5 pl-3 text-right tabular-nums font-semibold ${m.net >= 0 ? "text-success" : "text-error"}`}>{inr(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Category breakdown */}
        <SectionCard>
          <div className="text-sm font-semibold text-fg mb-3">Expenses by category · this month</div>
          {donut.some((d) => d.value > 0) ? (
            <DonutChart segments={donut} centerLabel={`${Math.round(fin.expense.month / 1000)}k`} centerSub="spent" />
          ) : (
            <div className="py-10 text-center text-sm text-muted">No expenses recorded this month.</div>
          )}
        </SectionCard>
      </div>

      {/* Add expense */}
      <SectionCard className="mb-6">
        <div className="text-sm font-semibold text-fg mb-3">Record an expense</div>
        <form action={createExpenseAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <label className="lg:col-span-1">
            <span className="label">Category</span>
            <select name="category" className="select" defaultValue="SUPPLIES">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="label">Description</span>
            <input name="description" required placeholder="e.g. October electricity bill" className="input" />
          </label>
          <label>
            <span className="label">Amount (₹)</span>
            <input name="amount" required inputMode="numeric" placeholder="0" className="input" />
          </label>
          <label>
            <span className="label">Paid via</span>
            <select name="paidVia" className="select" defaultValue="BANK">
              {PAID_VIA.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Date</span>
            <input name="spentAt" type="date" defaultValue={todayValue()} className="input" />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Vendor (optional)</span>
            <input name="vendor" placeholder="e.g. State Electricity Board" className="input" />
          </label>
          <div className="lg:col-span-4 flex items-end">
            <button className="btn-primary w-full sm:w-auto">Add expense</button>
          </div>
        </form>
      </SectionCard>

      {/* Expense ledger */}
      <SectionCard>
        <div className="text-sm font-semibold text-fg mb-1">Expense ledger</div>
        {expenses.length === 0 ? (
          <EmptyState title="No expenses yet" sub="Record your first operating expense above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Category</th>
                  <th className="th">Description</th>
                  <th className="th">Vendor</th>
                  <th className="th">Paid via</th>
                  <th className="th text-right">Amount</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="row-hover">
                    <td className="td text-muted whitespace-nowrap">{dateShort(e.spentAt)}</td>
                    <td className="td"><Tag>{e.category.charAt(0) + e.category.slice(1).toLowerCase()}</Tag></td>
                    <td className="td text-fg">{e.description}</td>
                    <td className="td text-muted">{e.vendor || "—"}</td>
                    <td className="td text-muted">{e.paidVia.charAt(0) + e.paidVia.slice(1).toLowerCase()}</td>
                    <td className="td text-right tabular-nums font-semibold text-error">{inr(e.amount)}</td>
                    <td className="td text-right">
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="btn-ghost text-xs text-error hover:bg-error/10" title="Delete expense" aria-label="Delete expense">Delete</button>
                      </form>
                    </td>
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
