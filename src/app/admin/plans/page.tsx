import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { inr } from "@/lib/format";
import { createPlanAction } from "../actions";

export default async function PlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { perStudentPrice: "asc" },
    include: { _count: { select: { tenants: true, subscriptions: true } } },
  });
  return (
    <>
      <PageHeader title="Subscription plans" sub="Per-student pricing · module bundles · take-rate" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {plans.map((p) => {
          const features = JSON.parse(p.features || "[]") as string[];
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold text-fg">{p.name}</div>
                <Tag tone={p.supportLevel === "DEDICATED" ? "accent" : "muted"}>{p.supportLevel}</Tag>
              </div>
              <div className="mt-1 text-3xl font-semibold text-fg tabular-nums">{inr(p.perStudentPrice)}<span className="text-sm text-muted font-normal">/student/mo</span></div>
              <ul className="mt-4 space-y-1.5 text-sm text-muted">
                {features.slice(0, 6).map((f) => <li key={f}>· {f}</li>)}
              </ul>
              <div className="mt-4 text-xs text-muted">
                {p._count.tenants} tenants · {p._count.subscriptions} subscriptions
              </div>
            </div>
          );
        })}
      </div>

      <SectionCard title="Create a plan">
        <form action={createPlanAction} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="label">Code</label><input className="input" name="code" required /></div>
          <div><label className="label">Name</label><input className="input" name="name" required /></div>
          <div><label className="label">₹ / student / month</label><input className="input" name="perStudentPrice" type="number" min={1} required /></div>
          <div><label className="label">Module limit (0 = all)</label><input className="input" name="moduleLimit" type="number" defaultValue={0} /></div>
          <div><label className="label">Storage (GB)</label><input className="input" name="storageGb" type="number" defaultValue={20} /></div>
          <div>
            <label className="label">Support level</label>
            <select className="select" name="supportLevel" defaultValue="STANDARD">
              <option>STANDARD</option><option>PRIORITY</option><option>DEDICATED</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label">Features (comma-separated)</label>
            <input className="input" name="features" placeholder="SIS, Attendance, Fee, Communication, Notice, Parent App" />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="btn-primary">Create plan</button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
