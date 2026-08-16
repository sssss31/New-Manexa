import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, Stat, EmptyState } from "@/components/ui";
import { LEAVE_LABEL } from "@/lib/leave";
import { dateShort } from "@/lib/format";
import { reviewLeaveAction } from "../actions";

export default async function InstitutionLeave() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;

  const [pending, recent, counts] = await Promise.all([
    prisma.staffLeave.findMany({
      where: { tenantId, status: "PENDING" },
      include: { staff: { include: { user: { select: { displayName: true, manexaId: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffLeave.findMany({
      where: { tenantId, status: { in: ["APPROVED", "REJECTED"] } },
      include: { staff: { include: { user: { select: { displayName: true } } } } },
      orderBy: { reviewedAt: "desc" }, take: 50,
    }),
    prisma.staffLeave.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
  ]);
  const countBy = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Staff Leave" sub="Review and approve staff leave requests. Balances are computed from approved records." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Pending" value={pending.length} tone={pending.length ? "warning" : "default"} />
        <Stat label="Approved" value={countBy("APPROVED")} tone="success" />
        <Stat label="Rejected" value={countBy("REJECTED")} />
        <Stat label="Total requests" value={counts.reduce((s, c) => s + c._count, 0)} />
      </div>

      <SectionCard title={`Pending approval · ${pending.length}`} className="mb-6">
        {pending.length === 0 ? (
          <EmptyState title="No pending requests" sub="Leave requests awaiting review will appear here." />
        ) : (
          <div className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-fg font-medium">{l.staff.user.displayName} <span className="font-mono text-xs text-muted">{l.staff.user.manexaId ?? ""}</span></div>
                  <div className="text-xs text-muted">
                    {LEAVE_LABEL[l.type as keyof typeof LEAVE_LABEL] ?? l.type} · {l.days} day{l.days === 1 ? "" : "s"} · {dateShort(l.fromDate)} → {dateShort(l.toDate)}
                  </div>
                  <div className="text-xs text-muted mt-0.5 max-w-lg truncate" title={l.reason}>“{l.reason}”</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={reviewLeaveAction}>
                    <input type="hidden" name="leaveId" value={l.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <button className="btn-secondary text-sm">Reject</button>
                  </form>
                  <form action={reviewLeaveAction}>
                    <input type="hidden" name="leaveId" value={l.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <button className="btn-primary text-sm">Approve</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent decisions">
        {recent.length === 0 ? (
          <div className="text-sm text-muted">No reviewed requests yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th">Staff</th><th className="th">Type</th><th className="th">Dates</th><th className="th text-right">Days</th><th className="th">Reviewed</th><th className="th">Status</th></tr></thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id} className="row-hover">
                    <td className="td">{l.staff.user.displayName}</td>
                    <td className="td text-muted">{LEAVE_LABEL[l.type as keyof typeof LEAVE_LABEL] ?? l.type}</td>
                    <td className="td text-muted whitespace-nowrap">{dateShort(l.fromDate)} → {dateShort(l.toDate)}</td>
                    <td className="td tabular-nums text-right">{l.days}</td>
                    <td className="td text-muted whitespace-nowrap">{l.reviewedAt ? dateShort(l.reviewedAt) : "—"}</td>
                    <td className="td"><StatusBadge status={l.status} /></td>
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
