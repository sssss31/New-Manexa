import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { dateShort, inr, relative } from "@/lib/format";

export default async function AdminOverview() {
  const [tenantCount, users, students, invoices, revenueAgg, recentAudit, recentTenants, activeBanners, subs] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.student.count(),
      prisma.invoice.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: true, tenant: true } }),
      prisma.tenant.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { plan: true } }),
      prisma.banner.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.aggregate({ _sum: { mrr: true } }),
    ]);

  return (
    <>
      <PageHeader
        title="Platform overview"
        sub="Every tenant, every subscription, every audit trail — all from here."
        actions={
          <>
            <Link href="/admin/tenants/new" className="btn-primary">+ New tenant</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Tenants" value={tenantCount} sub="Active institutions" tone="accent" />
        <Stat label="Students" value={students.toLocaleString()} sub="Across all tenants" />
        <Stat label="Users" value={users.toLocaleString()} sub="All roles" />
        <Stat label="MRR" value={inr(subs._sum.mrr ?? 0)} sub="Recurring revenue" tone="success" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Invoices" value={invoices.toLocaleString()} />
        <Stat label="GMV collected" value={inr(revenueAgg._sum.amount ?? 0)} tone="success" />
        <Stat label="Active banners" value={activeBanners} />
        <Stat label="Region" value="ap-south-1" sub="Primary · Mumbai" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Recent tenants" right={<Link href="/admin/tenants" className="text-xs text-accent">View all</Link>} className="lg:col-span-2">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[560px]">
              <thead className="text-left">
                <tr>
                  <th className="th">Institution</th>
                  <th className="th">Plan</th>
                  <th className="th">Isolation</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentTenants.map((t) => (
                  <tr key={t.id} className="row-hover">
                    <td className="td">
                      <div className="font-medium text-fg">{t.name}</div>
                      <div className="text-xs text-muted">{t.subdomain}.manexa.in</div>
                    </td>
                    <td className="td">{t.plan?.name ?? "—"}</td>
                    <td className="td"><Tag tone={t.isolation === "SILO" ? "accent" : "muted"}>{t.isolation}</Tag></td>
                    <td className="td"><StatusBadge status={t.status} /></td>
                    <td className="td text-muted">{dateShort(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Audit feed" right={<Link href="/admin/audit" className="text-xs text-accent">All events</Link>}>
          <ul className="space-y-3">
            {recentAudit.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="mt-1 dot" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-fg">{a.action.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted truncate">
                    {a.tenant?.name ?? "—"} · {a.actor?.displayName ?? "system"} · {relative(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
