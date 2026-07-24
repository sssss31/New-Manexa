import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { dateShort, inr } from "@/lib/format";

export default async function SubscriptionsPage() {
  const [subs, mrrAgg, activeCount] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { renewsAt: "asc" },
      include: { plan: true, tenant: true },
    }),
    prisma.subscription.aggregate({ _sum: { mrr: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
  ]);
  const mrr = mrrAgg._sum.mrr ?? 0;
  const arr = mrr * 12;

  return (
    <>
      <PageHeader title="Subscriptions" sub={`${subs.length} contracts across all tenants`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="MRR" value={inr(mrr)} tone="success" />
        <Stat label="ARR" value={inr(arr)} tone="accent" />
        <Stat label="Active" value={activeCount} />
        <Stat label="Renewals in 30d" value={subs.filter((s) => (s.renewsAt.getTime() - Date.now()) / 86400000 < 30).length} tone="warning" />
      </div>

      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Tenant</th>
              <th className="th">Plan</th>
              <th className="th">Seats</th>
              <th className="th">MRR</th>
              <th className="th">Renews</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="row-hover">
                <td className="td">{s.tenant.name}</td>
                <td className="td">{s.plan.name}</td>
                <td className="td tabular-nums">{s.studentSeats.toLocaleString()}</td>
                <td className="td tabular-nums">{inr(s.mrr)}</td>
                <td className="td text-muted">{dateShort(s.renewsAt)}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
