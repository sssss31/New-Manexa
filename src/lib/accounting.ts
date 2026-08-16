// ─────────────────────────────────────────────────────────────────────────
// Double-entry accounting engine for an institution's own books.
//
//   • Every posted JournalEntry is BALANCED — sum(debit) === sum(credit) > 0.
//     postJournal throws otherwise; there is no way to persist an unbalanced
//     entry.
//   • Postings are IDEMPOTENT per source record (unique [tenantId, source,
//     sourceId]) — re-posting a payment/expense is a no-op, so backfills and
//     retries never double-count.
//   • Entries are IMMUTABLE — corrections are new reversing entries (reverseEntry),
//     never edits/deletes.
//   • Everything is tenant-scoped and audited.
//
// Amounts are INR integers (decimal-safe — the whole app avoids floats for money).
// Trial Balance / General Ledger / P&L all DERIVE from these entries.
// ─────────────────────────────────────────────────────────────────────────

import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

export type AccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
export type NormalBalance = "DEBIT" | "CREDIT";

/** Default chart of accounts, seeded per institution. Codes are stable keys. */
export const DEFAULT_CHART: { code: string; name: string; type: AccountType; normalBalance: NormalBalance }[] = [
  // Assets (debit-normal)
  { code: "1000", name: "Cash", type: "ASSET", normalBalance: "DEBIT" },
  { code: "1010", name: "Bank", type: "ASSET", normalBalance: "DEBIT" },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", normalBalance: "DEBIT" },
  // Liabilities (credit-normal)
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2100", name: "Salary Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  // Equity
  { code: "3000", name: "Opening Balance Equity", type: "EQUITY", normalBalance: "CREDIT" },
  // Income (credit-normal)
  { code: "4000", name: "Tuition Fees", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4010", name: "Transport Fees", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4020", name: "Exam Fees", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4030", name: "Admission Fees", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4090", name: "Other Income", type: "INCOME", normalBalance: "CREDIT" },
  // Expenses (debit-normal)
  { code: "5000", name: "Salaries", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5010", name: "Utilities", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5020", name: "Rent", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5030", name: "Maintenance", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5040", name: "Transport", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5050", name: "Supplies", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5070", name: "Marketing", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5080", name: "Events", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5900", name: "Other Expenses", type: "EXPENSE", normalBalance: "DEBIT" },
];

/** Fee/expense → account-code mappings (single source of truth). */
const EXPENSE_ACCOUNT: Record<string, string> = {
  SALARY: "5000", UTILITIES: "5010", RENT: "5020", MAINTENANCE: "5030",
  TRANSPORT: "5040", SUPPLIES: "5050", MARKETING: "5070", EVENTS: "5080", OTHER: "5900",
};
/** Cash for physical cash, Bank for every electronic/instrument method. */
function cashOrBankCode(method: string): string {
  return method.toUpperCase() === "CASH" ? "1000" : "1010";
}
export function expenseAccountCode(category: string): string {
  return EXPENSE_ACCOUNT[category.toUpperCase()] ?? "5900";
}

/** Idempotently seed the default chart of accounts for a tenant. */
export async function seedChartOfAccounts(tenantId: string, db: Db = prisma): Promise<void> {
  await db.ledgerAccount.createMany({
    data: DEFAULT_CHART.map((a) => ({ tenantId, ...a, isSystem: true })),
    skipDuplicates: true,
  });
}

/** Resolve an account id by code, seeding the chart on first miss. */
async function accountId(tenantId: string, code: string, db: Db): Promise<string> {
  let acc = await db.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { id: true } });
  if (!acc) {
    await seedChartOfAccounts(tenantId, db);
    acc = await db.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { id: true } });
  }
  if (!acc) throw new Error(`Ledger account ${code} not found`);
  return acc.id;
}

export interface JournalLineInput {
  code: string;
  debit?: number;
  credit?: number;
}

/**
 * Post a balanced journal entry. Throws if debits != credits or the entry is
 * empty/zero. Idempotent per (source, sourceId): a duplicate post returns the
 * existing entry id instead of creating a second one.
 */
export async function postJournal(
  input: {
    tenantId: string;
    description: string;
    lines: JournalLineInput[];
    source?: string;
    sourceId?: string | null;
    reference?: string | null;
    date?: Date;
    actorId?: string | null;
  },
  db: Db = prisma
): Promise<{ entryId: string; duplicate: boolean }> {
  const totalDebit = input.lines.reduce((s, l) => s + Math.round(l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + Math.round(l.credit ?? 0), 0);
  if (totalDebit <= 0 || totalCredit <= 0) throw new Error("Journal entry must have non-zero debit and credit");
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry: debit ₹${totalDebit} ≠ credit ₹${totalCredit}`);
  }

  const source = input.source ?? "MANUAL";
  const sourceId = input.sourceId ?? null;

  // Idempotency: one entry per source record.
  if (sourceId) {
    const existing = await db.journalEntry.findUnique({
      where: { tenantId_source_sourceId: { tenantId: input.tenantId, source, sourceId } },
      select: { id: true },
    });
    if (existing) return { entryId: existing.id, duplicate: true };
  }

  // Resolve account ids (seeds the chart if this tenant has none yet).
  const lineData = await Promise.all(
    input.lines.map(async (l) => ({
      accountId: await accountId(input.tenantId, l.code, db),
      debit: Math.round(l.debit ?? 0),
      credit: Math.round(l.credit ?? 0),
    }))
  );

  try {
    const entry = await db.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        description: input.description,
        source,
        sourceId,
        reference: input.reference ?? null,
        date: input.date ?? new Date(),
        createdById: input.actorId ?? null,
        lines: { create: lineData },
      },
      select: { id: true },
    });
    await audit({
      tenantId: input.tenantId,
      actorId: input.actorId ?? undefined,
      action: "LEDGER_POST",
      entity: "JournalEntry",
      entityId: entry.id,
      detail: `${input.description} · ₹${totalDebit} · ${source}`,
    }).catch(() => {});
    return { entryId: entry.id, duplicate: false };
  } catch (e) {
    // Lost an idempotency race → the other writer already posted it.
    if ((e as { code?: string }).code === "P2002" && sourceId) {
      const existing = await db.journalEntry.findUnique({
        where: { tenantId_source_sourceId: { tenantId: input.tenantId, source, sourceId } },
        select: { id: true },
      });
      if (existing) return { entryId: existing.id, duplicate: true };
    }
    throw e;
  }
}

/** Fee payment → Dr Cash/Bank, Cr Tuition Fees. */
export async function postPaymentJournal(
  input: { tenantId: string; paymentId: string; amount: number; method: string; invoiceNumber: string; date?: Date; actorId?: string | null },
  db: Db = prisma
) {
  return postJournal(
    {
      tenantId: input.tenantId,
      description: `Fee payment · Invoice ${input.invoiceNumber}`,
      source: "PAYMENT",
      sourceId: input.paymentId,
      reference: input.invoiceNumber,
      date: input.date,
      actorId: input.actorId,
      lines: [
        { code: cashOrBankCode(input.method), debit: input.amount },
        { code: "4000", credit: input.amount },
      ],
    },
    db
  );
}

/** Expense → Dr Expense account, Cr Cash/Bank. */
export async function postExpenseJournal(
  input: { tenantId: string; expenseId: string; amount: number; category: string; paidVia: string; description: string; date?: Date; actorId?: string | null },
  db: Db = prisma
) {
  return postJournal(
    {
      tenantId: input.tenantId,
      description: `Expense · ${input.description}`,
      source: "EXPENSE",
      sourceId: input.expenseId,
      date: input.date,
      actorId: input.actorId,
      lines: [
        { code: expenseAccountCode(input.category), debit: input.amount },
        { code: cashOrBankCode(input.paidVia), credit: input.amount },
      ],
    },
    db
  );
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  debit: number; // net debit balance (0 if credit-side)
  credit: number; // net credit balance (0 if debit-side)
}

/**
 * Trial balance derived from journal lines. Each account's net balance is placed
 * on its natural side. Total debits MUST equal total credits (returned as
 * `balanced`), which is the integrity proof for the whole ledger.
 */
export async function trialBalance(
  tenantId: string,
  opts: { to?: Date } = {}
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean }> {
  const [accounts, sums] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { tenantId }, orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { entry: { tenantId, ...(opts.to ? { date: { lte: opts.to } } : {}) } },
      _sum: { debit: true, credit: true },
    }),
  ]);
  const byAccount = new Map(sums.map((s) => [s.accountId, { d: s._sum.debit ?? 0, c: s._sum.credit ?? 0 }]));

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of accounts) {
    const s = byAccount.get(a.id) ?? { d: 0, c: 0 };
    const net = s.d - s.c; // >0 → net debit; <0 → net credit
    if (net === 0 && s.d === 0 && s.c === 0) continue; // skip unused accounts
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ code: a.code, name: a.name, type: a.type as AccountType, debit, credit });
  }
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export interface LedgerLine {
  date: Date;
  entryId: string;
  description: string;
  reference: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number; // running balance (signed, debit-positive)
}

/** General ledger lines with a running balance, optionally filtered by account/date. */
export async function generalLedger(
  tenantId: string,
  opts: { accountCode?: string; from?: Date; to?: Date; limit?: number } = {}
): Promise<LedgerLine[]> {
  const account = opts.accountCode
    ? await prisma.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId, code: opts.accountCode } }, select: { id: true } })
    : null;

  const lines = await prisma.journalLine.findMany({
    where: {
      entry: { tenantId, ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}) },
      ...(account ? { accountId: account.id } : {}),
    },
    include: { entry: { select: { date: true, description: true, reference: true } }, account: { select: { code: true, name: true } } },
    orderBy: [{ entry: { date: "asc" } }, { id: "asc" }],
    take: opts.limit ?? 500,
  });

  let running = 0;
  return lines.map((l) => {
    running += l.debit - l.credit;
    return {
      date: l.entry.date,
      entryId: l.entryId,
      description: l.entry.description,
      reference: l.entry.reference,
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: l.debit,
      credit: l.credit,
      balance: running,
    };
  });
}
