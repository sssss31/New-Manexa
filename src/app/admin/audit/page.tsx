import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { dateTimeShort } from "@/lib/format";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { actor: true, tenant: true },
  });
  const rows = logs.map((l) => ({
    when: dateTimeShort(l.createdAt),
    tenant: l.tenant?.name ?? "—",
    actor: l.actor?.displayName ?? "system",
    action: l.action,
    entity: l.entity,
    detail: l.detail ?? "—",
  }));
  return (
    <>
      <PageHeader title="Audit log" sub="Every security- and money-relevant action. Append-only, exportable for compliance." />
      <SectionCard>
        <DataTable
          exportName="audit-log"
          searchPlaceholder="Filter by action, actor, tenant…"
          columns={[
            { key: "when", label: "When" },
            { key: "tenant", label: "Tenant" },
            { key: "actor", label: "Actor" },
            { key: "action", label: "Action" },
            { key: "entity", label: "Entity" },
            { key: "detail", label: "Detail" },
          ]}
          rows={rows}
        />
      </SectionCard>
    </>
  );
}
