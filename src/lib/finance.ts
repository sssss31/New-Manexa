// Institution accounting — income (from fee Payments) vs operating Expenses,
// with a live P&L. All amounts are INR integers. Every mutation is tenant-scoped
// and audited (money actions). Categories are a fixed, known set so reports and
// the breakdown chart stay consistent.
import { prisma } from "./prisma";
import { audit } from "./audit";

export const EXPENSE_CATEGORIES = [
  "SALARY",
  "UTILITIES",
  "MAINTENANCE",
  "SUPPLIES",
  "RENT",
  "TRANSPORT",
  "MARKETING",
  "EVENTS",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAID_VIA = ["CASH", "BANK", "UPI", "CHEQUE"] as const;
export type PaidVia = (typeof PAID_VIA)[number];

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}
export function isPaidVia(v: string): v is PaidVia {
  return (PAID_VIA as readonly string[]).includes(v);
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short" });

export type FinanceOverview = {
  income: { month: number; total: number };
  expense: { month: number; total: number };
  net: { month: number; total: number };
  byCategory: { category: string; amount: number }[];
  monthly: { key: string; label: string; income: number; expense: number; net: number }[];
};

/** Live P&L: current-month + all-time income/expense/net, this month's expense
 *  breakdown by category, and a 6-month income-vs-expense trend. */
export async function financeOverview(tenantId: string): Promise<FinanceOverview> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [incomeTotal, expenseTotal, payRows, expRows, catRows] = await Promise.all([
    prisma.payment.aggregate({ where: { invoice: { tenantId } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { tenantId }, _sum: { amount: true } }),
    prisma.payment.findMany({ where: { invoice: { tenantId }, paidAt: { gte: sixAgo } }, select: { paidAt: true, amount: true } }),
    prisma.expense.findMany({ where: { tenantId, spentAt: { gte: sixAgo } }, select: { spentAt: true, amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { tenantId, spentAt: { gte: monthStart } }, _sum: { amount: true } }),
  ]);

  // 6-month buckets (oldest → newest), pre-seeded so gaps render as zero.
  const buckets = new Map<string, { key: string; label: string; income: number; expense: number; net: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), { key: monthKey(d), label: monthLabel(d), income: 0, expense: 0, net: 0 });
  }
  for (const p of payRows) {
    const b = buckets.get(monthKey(p.paidAt));
    if (b) b.income += p.amount;
  }
  for (const e of expRows) {
    const b = buckets.get(monthKey(e.spentAt));
    if (b) b.expense += e.amount;
  }
  const monthly = [...buckets.values()].map((b) => ({ ...b, net: b.income - b.expense }));

  const curKey = monthKey(now);
  const cur = buckets.get(curKey)!;
  const incomeMonth = cur.income;
  const expenseMonth = cur.expense;

  const byCategory = catRows
    .map((r) => ({ category: r.category, amount: r._sum.amount ?? 0 }))
    .sort((a, b) => b.amount - a.amount);

  const incomeAll = incomeTotal._sum.amount ?? 0;
  const expenseAll = expenseTotal._sum.amount ?? 0;

  return {
    income: { month: incomeMonth, total: incomeAll },
    expense: { month: expenseMonth, total: expenseAll },
    net: { month: incomeMonth - expenseMonth, total: incomeAll - expenseAll },
    byCategory,
    monthly,
  };
}

export type NewExpense = {
  category: string;
  description: string;
  amount: number;
  paidVia: string;
  vendor?: string | null;
  spentAt?: Date | null;
};

/** Create an expense (validated + audited). Throws on invalid input. */
export async function createExpense(tenantId: string, actorId: string | null, data: NewExpense) {
  const category = isExpenseCategory(data.category) ? data.category : "OTHER";
  const paidVia = isPaidVia(data.paidVia) ? data.paidVia : "CASH";
  const description = data.description.trim();
  if (!description) throw new Error("Description is required");
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Amount must be a positive number");
  const amount = Math.round(data.amount);

  const expense = await prisma.expense.create({
    data: {
      tenantId,
      category,
      description,
      amount,
      paidVia,
      vendor: data.vendor?.trim() || null,
      spentAt: data.spentAt ?? new Date(),
      createdById: actorId,
    },
  });
  await audit({ tenantId, actorId, action: "EXPENSE_CREATED", entity: "Expense", entityId: expense.id, detail: `${category} · ₹${amount} · ${description}` });
  return expense;
}

/** Delete an expense the caller's tenant owns. Returns whether a row was removed. */
export async function deleteExpense(tenantId: string, actorId: string | null, id: string): Promise<boolean> {
  const res = await prisma.expense.deleteMany({ where: { id, tenantId } });
  if (res.count > 0) {
    await audit({ tenantId, actorId, action: "EXPENSE_DELETED", entity: "Expense", entityId: id });
  }
  return res.count > 0;
}
