import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, EmptyState } from "@/components/ui";
import { leaveBalance, LEAVE_TYPES, LEAVE_LABEL } from "@/lib/leave";
import { dateShort } from "@/lib/format";
import { applyLeaveAction } from "../actions";

export default async function TeacherLeave() {
  const user = await requireRole("TEACHER");
  const staff = await prisma.staff.findFirst({ where: { userId: user.id, tenantId: user.tenantId!, status: "ACTIVE" }, select: { id: true } });
  if (!staff) {
    return (<><PageHeader title="My Leave" /><SectionCard><div className="text-sm text-muted">No active staff record is linked to your account.</div></SectionCard></>);
  }

  const [balance, leaves] = await Promise.all([
    leaveBalance(user.tenantId!, staff.id),
    prisma.staffLeave.findMany({ where: { tenantId: user.tenantId!, staffId: staff.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <>
      <PageHeader title="My Leave" sub="Apply for leave and track your balance — reviewed by HR/admin." />

      {/* Balance cards — computed from real approved records (§16). */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {balance.map((b) => (
          <div key={b.type} className="card p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted">{LEAVE_LABEL[b.type]}</div>
            <div className="text-xl font-semibold text-fg tabular-nums mt-0.5">
              {b.remaining === null ? "—" : b.remaining}<span className="text-xs text-muted">{b.allocated ? ` / ${b.allocated}` : " uncapped"}</span>
            </div>
            <div className="text-[11px] text-muted mt-0.5">{b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Apply for leave">
          <form action={applyLeaveAction} className="space-y-3">
            <label className="block"><span className="label">Type</span>
              <select name="type" className="select" required>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_LABEL[t]}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="label">From</span><input name="fromDate" type="date" required className="input" /></label>
              <label className="block"><span className="label">To</span><input name="toDate" type="date" required className="input" /></label>
            </div>
            <label className="block"><span className="label">Reason</span><textarea name="reason" required className="textarea" rows={3} placeholder="Brief reason" /></label>
            <button className="btn-primary w-full">Submit request</button>
          </form>
        </SectionCard>

        <SectionCard title="My requests" className="lg:col-span-2">
          {leaves.length === 0 ? (
            <EmptyState title="No leave requests yet" sub="Apply for leave to see it here." />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full min-w-[560px]">
                <thead><tr><th className="th">Type</th><th className="th">From</th><th className="th">To</th><th className="th text-right">Days</th><th className="th">Reason</th><th className="th">Status</th></tr></thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} className="row-hover">
                      <td className="td">{LEAVE_LABEL[l.type as keyof typeof LEAVE_LABEL] ?? l.type}</td>
                      <td className="td text-muted whitespace-nowrap">{dateShort(l.fromDate)}</td>
                      <td className="td text-muted whitespace-nowrap">{dateShort(l.toDate)}</td>
                      <td className="td tabular-nums text-right">{l.days}</td>
                      <td className="td text-muted max-w-[220px] truncate" title={l.reason}>{l.reason}</td>
                      <td className="td"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
