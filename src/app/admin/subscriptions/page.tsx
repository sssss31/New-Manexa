import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { dateShort, inr } from "@/lib/format";

export default async function SubscriptionsPage() {
  const [subs, mrrAgg, activeCount, studentsByTenant, staffByTenant] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { renewsAt: "asc" },
      include: { plan: true, tenant: true },
    }),
    prisma.subscription.aggregate({ _sum: { mrr: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    // Billable usage metered from LIVE active records — two grouped counts total
    // (not per-tenant), so this stays O(1) queries at 100k+ institutions.
    prisma.student.groupBy({ by: ["tenantId"], where: { status: "ACTIVE" }, _count: true }),
    prisma.staff.groupBy({ by: ["tenantId"], where: { status: "ACTIVE" }, _count: true }),
  ]);
  const mrr = mrrAgg._sum.mrr ?? 0;
  const arr = mrr * 12;
  const memberCount = new Map<string, number>();
  for (const r of studentsByTenant) memberCount.set(r.tenantId, (memberCount.get(r.tenantId) ?? 0) + r._count);
  for (const r of staffByTenant) memberCount.set(r.tenantId, (memberCount.get(r.tenantId) ?? 0) + r._count);
  const totalBillableMembers = [...memberCount.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Subscriptions" sub={`${subs.length} contracts across all tenants`} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="MRR" value={inr(mrr)} tone="success" />
        <Stat label="ARR" value={inr(arr)} tone="accent" />
        <Stat label="Active" value={activeCount} />
        <Stat label="Billable members" value={totalBillableMembers.toLocaleString()} tone="accent" />
        <Stat label="Renewals in 30d" value={subs.filter((s) => (s.renewsAt.getTime() - Date.now()) / 86400000 < 30).length} tone="warning" />
      </div>

      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Tenant</th>
              <th className="th">Plan</th>
              <th className="th">Members</th>
              <th className="th">Seats</th>
              <th className="th">MRR</th>
              <th className="th">Renews</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const members = memberCount.get(s.tenantId) ?? 0;
              const over = members > s.studentSeats;
              return (
              <tr key={s.id} className="row-hover">
                <td className="td">{s.tenant.name}</td>
                <td className="td">{s.plan.name}</td>
                <td className={`td tabular-nums ${over ? "text-warning" : ""}`} title="Live billable members (active students + staff)">{members.toLocaleString()}</td>
                <td className="td tabular-nums">{s.studentSeats.toLocaleString()}</td>
                <td className="td tabular-nums">{inr(s.mrr)}</td>
                <td className="td text-muted">{dateShort(s.renewsAt)}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
