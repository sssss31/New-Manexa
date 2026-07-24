import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KV, PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { dateShort, inr, relative } from "@/lib/format";

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.tenant.findUnique({
    where: { id },
    include: {
      plan: true,
      subscriptions: { include: { plan: true } },
      _count: { select: { students: true, staff: true, users: true, invoices: true, notices: true } },
    },
  });
  if (!t) notFound();
  const [recentAudit, recentInvoices] = await Promise.all([
    prisma.auditLog.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.invoice.findMany({ where: { tenantId: t.id }, orderBy: { issueDate: "desc" }, take: 6, include: { student: { include: { user: true } } } }),
  ]);
  return (
    <>
      <PageHeader
        title={t.name}
        sub={`${t.subdomain}.manexa.in · ${t.board ?? "—"} · ${t.isolation} isolation`}
        actions={<StatusBadge status={t.status} />}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Students" value={t._count.students} />
        <Stat label="Staff" value={t._count.staff} />
        <Stat label="Users" value={t._count.users} />
        <Stat label="Invoices" value={t._count.invoices} />
        <Stat label="MRR" value={inr(t.subscriptions.reduce((s, x) => s + x.mrr, 0))} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Account">
          <KV k="Code" v={t.code} />
          <KV k="Board" v={t.board ?? "—"} />
          <KV k="Isolation" v={<Tag tone={t.isolation === "SILO" ? "accent" : "muted"}>{t.isolation}</Tag>} />
          <KV k="Plan" v={t.plan?.name ?? "—"} />
          <KV k="Currency" v={t.currency} />
          <KV k="Onboarded" v={dateShort(t.createdAt)} />
        </SectionCard>
        <SectionCard title="Recent invoices" className="lg:col-span-2" right={<Link href="/admin/tenants" className="text-xs text-accent">All tenants</Link>}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Student</th>
                <th className="th">Period</th>
                <th className="th">Amount</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td font-mono text-xs">{i.number}</td>
                  <td className="td">{i.student.user.displayName}</td>
                  <td className="td text-muted">{i.periodLabel}</td>
                  <td className="td tabular-nums">{inr(i.total)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard title="Recent audit for this tenant" className="mt-4">
        <ul className="space-y-2">
          {recentAudit.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between border-b border-border pb-1.5 last:border-0">
              <div className="text-sm text-fg">{a.action.replace(/_/g, " ")} <span className="text-muted">· {a.entity}{a.detail ? ` · ${a.detail}` : ""}</span></div>
              <div className="text-xs text-muted">{relative(a.createdAt)}</div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
