import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedChartOfAccounts, type AccountType } from "@/lib/accounting";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui";

const TYPE_ORDER: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const TYPE_LABEL: Record<AccountType, string> = {
  ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expenses",
};

export default async function ChartOfAccountsPage() {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;

  // Self-heal: an institution created before the ledger existed gets its chart
  // seeded on first view (idempotent).
  let accounts = await prisma.ledgerAccount.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
  if (accounts.length === 0) {
    await seedChartOfAccounts(tenantId);
    accounts = await prisma.ledgerAccount.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
  }

  const byType = new Map<string, typeof accounts>();
  for (const a of accounts) {
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type)!.push(a);
  }

  return (
    <>
      <PageHeader title="Chart of Accounts" sub="The institution's account structure. Every posting maps to one of these accounts." />
      {accounts.length === 0 ? (
        <EmptyState title="No accounts" sub="The default chart could not be seeded." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TYPE_ORDER.filter((t) => byType.has(t)).map((t) => (
            <SectionCard key={t} title={TYPE_LABEL[t]}>
              <ul className="divide-y divide-border">
                {byType.get(t)!.map((a) => (
                  <li key={a.code} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-muted shrink-0">{a.code}</span>
                      <span className="text-fg truncate">{a.name}</span>
                    </div>
                    <Link href={`/accounts/ledger?account=${a.code}`} className="text-xs text-accent hover:underline shrink-0">
                      View ledger →
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </>
  );
}
