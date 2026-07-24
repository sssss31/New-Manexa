import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { dateShort, inr } from "@/lib/format";

export default async function TenantsList() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      subscriptions: true,
      _count: { select: { students: true, staff: true, users: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Tenants"
        sub={`${tenants.length} institutions on MANEXA`}
        actions={<Link href="/admin/tenants/new" className="btn-primary">+ Onboard tenant</Link>}
      />

      <SectionCard>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="th">Institution</th>
                <th className="th">Plan</th>
                <th className="th">Isolation</th>
                <th className="th">Students</th>
                <th className="th">Staff</th>
                <th className="th">MRR</th>
                <th className="th">Status</th>
                <th className="th">Since</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="row-hover">
                  <td className="td">
                    <Link href={`/admin/tenants/${t.id}`} className="font-medium text-fg hover:text-accent">
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted">{t.subdomain}.manexa.in · {t.board ?? "—"}</div>
                  </td>
                  <td className="td">{t.plan?.name ?? "—"}</td>
                  <td className="td"><Tag tone={t.isolation === "SILO" ? "accent" : "muted"}>{t.isolation}</Tag></td>
                  <td className="td tabular-nums">{t._count.students.toLocaleString()}</td>
                  <td className="td tabular-nums">{t._count.staff.toLocaleString()}</td>
                  <td className="td tabular-nums">{inr(t.subscriptions.reduce((s, x) => s + x.mrr, 0))}</td>
                  <td className="td"><StatusBadge status={t.status} /></td>
                  <td className="td text-muted">{dateShort(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
