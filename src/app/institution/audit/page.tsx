import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { dateTimeShort, relative } from "@/lib/format";

export default async function TenantAuditPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const logs = await prisma.auditLog.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: true },
  });
  return (
    <>
      <PageHeader title="Audit trail" sub="Every mutation performed on this institution" />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">When</th>
              <th className="th">Actor</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="row-hover">
                <td className="td text-xs text-muted" title={dateTimeShort(l.createdAt)}>{relative(l.createdAt)}</td>
                <td className="td">{l.actor?.displayName ?? "system"}</td>
                <td className="td font-mono text-xs">{l.action}</td>
                <td className="td">{l.entity}</td>
                <td className="td text-muted">{l.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
