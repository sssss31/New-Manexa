import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard } from "@/components/ui";
import { createTenantAction } from "../../actions";

export default async function NewTenant() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { perStudentPrice: "asc" } });
  return (
    <>
      <PageHeader title="Onboard tenant" sub="Provision an institution on MANEXA. Silo mode gets a dedicated database in prod." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form action={createTenantAction} className="lg:col-span-2">
          <SectionCard title="Institution">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Legal name</label>
                <input name="name" className="input" required placeholder="Delhi Public School, Pune" />
              </div>
              <div>
                <label className="label">Subdomain</label>
                <input name="subdomain" className="input" required placeholder="dpspune" />
              </div>
              <div>
                <label className="label">Institution code</label>
                <input name="code" className="input" required placeholder="DPSP" />
              </div>
              <div>
                <label className="label">Board</label>
                <select name="board" className="select">
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="STATE">State</option>
                  <option value="IB">IB</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="label">Isolation mode</label>
                <select name="isolation" className="select" defaultValue="POOLED">
                  <option value="POOLED">Pooled — shared DB (Standard)</option>
                  <option value="BRIDGE">Bridge — dedicated DB per tenant (Pro)</option>
                  <option value="SILO">Silo — dedicated namespace (Enterprise)</option>
                </select>
              </div>
              <div>
                <label className="label">Plan</label>
                <select name="planCode" className="select" defaultValue="">
                  <option value="">— None —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.name} · ₹{p.perStudentPrice}/student
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="hairline my-6" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Institution admin — name</label>
                <input name="adminName" className="input" required placeholder="Neha Kulkarni" />
              </div>
              <div>
                <label className="label">Institution admin — email</label>
                <input name="adminEmail" type="email" className="input" required placeholder="admin@school.test" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="submit" className="btn-primary">Provision tenant</button>
            </div>
          </SectionCard>
        </form>

        <SectionCard title="What happens next">
          <ol className="space-y-3 text-sm text-muted list-decimal ml-4">
            <li>Allocate tenant identifier, subdomain, default branding.</li>
            <li>Provision data stores per isolation mode.</li>
            <li>Seed reference data (curricula, grade scales, fee templates).</li>
            <li>Create the Institution Admin account; welcome email sent.</li>
            <li>Move status <span className="text-fg font-medium">PROVISIONING → ACTIVE</span>.</li>
          </ol>
        </SectionCard>
      </div>
    </>
  );
}
