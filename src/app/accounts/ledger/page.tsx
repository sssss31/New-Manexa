import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generalLedger } from "@/lib/accounting";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";

export default async function GeneralLedgerPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const user = await requireRole("ACCOUNTANT");
  const tenantId = user.tenantId!;
  const { account } = await searchParams;

  const [accounts, lines] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    generalLedger(tenantId, { accountCode: account || undefined, limit: 500 }),
  ]);

  return (
    <>
      <PageHeader title="General Ledger" sub="Posted journal lines with a running balance. Entries are immutable — corrections are reversing entries." />

      <SectionCard>
        {/* Server-side account filter (GET form → searchParams → scoped query). */}
        <form method="get" className="flex flex-wrap items-center gap-2 mb-4">
          <label className="label sr-only" htmlFor="account">Account</label>
          <select id="account" name="account" className="select max-w-xs" defaultValue={account ?? ""}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
          <button className="btn-secondary">Filter</button>
        </form>

        {lines.length === 0 ? (
          <EmptyState title="No ledger entries" sub={account ? "No postings for this account yet." : "Record a payment or expense to post to the ledger."} />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Account</th>
                  <th className="th">Description</th>
                  <th className="th">Ref</th>
                  <th className="th text-right">Debit</th>
                  <th className="th text-right">Credit</th>
                  <th className="th text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.entryId + i} className="row-hover">
                    <td className="td text-muted whitespace-nowrap">{dateShort(l.date)}</td>
                    <td className="td"><span className="font-mono text-xs text-muted">{l.accountCode}</span> {l.accountName}</td>
                    <td className="td text-muted">{l.description}</td>
                    <td className="td font-mono text-xs text-subtle">{l.reference ?? "—"}</td>
                    <td className="td tabular-nums text-right">{l.debit ? inr(l.debit) : "—"}</td>
                    <td className="td tabular-nums text-right">{l.credit ? inr(l.credit) : "—"}</td>
                    <td className="td tabular-nums text-right font-medium">{inr(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length >= 500 && <p className="text-xs text-muted mt-3">Showing the first 500 lines — filter by account or narrow the date range to see more.</p>}
          </div>
        )}
      </SectionCard>
    </>
  );
}
