import { requireRole } from "@/lib/auth";
import { trialBalance } from "@/lib/accounting";
import { PageHeader, SectionCard, Stat, EmptyState } from "@/components/ui";
import { inr } from "@/lib/format";

export default async function TrialBalancePage() {
  const user = await requireRole("ACCOUNTANT");
  const tb = await trialBalance(user.tenantId!);

  return (
    <>
      <PageHeader title="Trial Balance" sub="Every account's net balance on its natural side — the ledger's integrity proof (debits = credits)." />

      {tb.rows.length === 0 ? (
        <EmptyState title="No posted entries yet" sub="Record a fee payment or an expense to start the books." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Stat label="Total debits" value={inr(tb.totalDebit)} />
            <Stat label="Total credits" value={inr(tb.totalCredit)} />
            <Stat label="Status" value={tb.balanced ? "Balanced ✓" : "Unbalanced"} tone={tb.balanced ? "success" : "error"} />
          </div>

          <SectionCard>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className="th">Code</th>
                    <th className="th">Account</th>
                    <th className="th">Type</th>
                    <th className="th text-right">Debit</th>
                    <th className="th text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.code} className="row-hover">
                      <td className="td font-mono text-xs">{r.code}</td>
                      <td className="td font-medium">{r.name}</td>
                      <td className="td text-muted text-xs">{r.type}</td>
                      <td className="td tabular-nums text-right">{r.debit ? inr(r.debit) : "—"}</td>
                      <td className="td tabular-nums text-right">{r.credit ? inr(r.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="td" colSpan={3}>Total</td>
                    <td className="td tabular-nums text-right text-accent">{inr(tb.totalDebit)}</td>
                    <td className="td tabular-nums text-right text-accent">{inr(tb.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
