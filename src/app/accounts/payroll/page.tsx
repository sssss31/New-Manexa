import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Stat } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";
import { approvePayrollAction, disbursePayrollAction, runPayrollAction } from "../actions";

export default async function PayrollPage() {
  const user = await requireRole("ACCOUNTANT");
  const runs = await prisma.payrollRun.findMany({
    where: { tenantId: user.tenantId! },
    include: { lines: { include: { staff: { include: { user: true } } } } },
    orderBy: { runAt: "desc" },
  });
  const label = new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
  return (
    <>
      <PageHeader
        title="Payroll"
        sub="PF · ESI · TDS deducted per Indian statutes"
        actions={
          <form action={runPayrollAction}>
            <input type="hidden" name="period" value={label} />
            <button className="btn-primary">Run payroll · {label}</button>
          </form>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Runs" value={runs.length} />
        <Stat label="Latest gross" value={inr(runs[0]?.totalGross ?? 0)} tone="accent" />
        <Stat label="Latest net" value={inr(runs[0]?.totalNet ?? 0)} tone="success" />
        <Stat label="Latest status" value={runs[0]?.status ?? "—"} />
      </div>

      <div className="space-y-4">
        {runs.map((r) => (
          <SectionCard
            key={r.id}
            title={`${r.period} · ${r.lines.length} staff`}
            right={
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === "DRAFT" && (
                  <form action={approvePayrollAction}>
                    <input type="hidden" name="runId" value={r.id} />
                    <button className="btn-secondary text-xs">Approve</button>
                  </form>
                )}
                {r.status === "APPROVED" && (
                  <form action={disbursePayrollAction}>
                    <input type="hidden" name="runId" value={r.id} />
                    <button className="btn-primary text-xs">Disburse</button>
                  </form>
                )}
              </div>
            }
          >
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Gross</th>
                  <th className="th">PF</th>
                  <th className="th">ESI</th>
                  <th className="th">TDS</th>
                  <th className="th">Net</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => (
                  <tr key={l.id} className="row-hover">
                    <td className="td">{l.staff.user.displayName}<div className="text-xs text-muted">{l.staff.employeeCode}</div></td>
                    <td className="td tabular-nums">{inr(l.gross)}</td>
                    <td className="td tabular-nums text-muted">{inr(l.pf)}</td>
                    <td className="td tabular-nums text-muted">{inr(l.esi)}</td>
                    <td className="td tabular-nums text-muted">{inr(l.tds)}</td>
                    <td className="td tabular-nums font-semibold">{inr(l.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-3">Generated {dateShort(r.runAt)}</div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
