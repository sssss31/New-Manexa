import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { KV, PageHeader, SectionCard, Tag } from "@/components/ui";

export default async function InstitutionSettings() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const t = await prisma.tenant.findUnique({
    where: { id: user.tenantId! },
    include: { plan: true },
  });
  if (!t) return null;
  return (
    <>
      <PageHeader title="Institution settings" sub="Branding, plan, and tenant details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Tenant">
          <KV k="Name" v={t.name} />
          <KV k="Code" v={t.code} />
          <KV k="Subdomain" v={`${t.subdomain}.manexa.in`} />
          <KV k="Board" v={t.board ?? "—"} />
          <KV k="Isolation" v={<Tag tone={t.isolation === "SILO" ? "accent" : "muted"}>{t.isolation}</Tag>} />
          <KV k="Plan" v={t.plan?.name ?? "—"} />
        </SectionCard>
        <SectionCard title="What's included in your plan">
          <ul className="space-y-1 text-sm text-muted">
            {JSON.parse(t.plan?.features ?? "[]").map((f: string) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {!t.plan && <div className="text-sm text-muted">No plan attached. Contact platform ops.</div>}
        </SectionCard>
      </div>
    </>
  );
}
