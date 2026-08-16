import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { inr } from "@/lib/format";
import { createFeeStructureAction } from "../actions";

export default async function FeeStructuresPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const [structures, classes] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { tenantId: user.tenantId! },
      include: { class: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.findMany({ where: { tenantId: user.tenantId! }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Fee structures" sub="Head-wise fees per class · monthly / quarterly / annual" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Existing structures" className="lg:col-span-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Class</th>
                <th className="th">Name</th>
                <th className="th">Frequency</th>
                <th className="th">Tuition</th>
                <th className="th">Transport</th>
                <th className="th">Other</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => {
                const other = s.lab + s.activity + s.exam + s.misc + s.hostel;
                const total = s.tuition + s.transport + other;
                return (
                  <tr key={s.id} className="row-hover">
                    <td className="td">{s.class.name}</td>
                    <td className="td">{s.name}</td>
                    <td className="td text-muted">{s.frequency}</td>
                    <td className="td tabular-nums">{inr(s.tuition)}</td>
                    <td className="td tabular-nums">{inr(s.transport)}</td>
                    <td className="td tabular-nums">{inr(other)}</td>
                    <td className="td tabular-nums font-semibold">{inr(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Add structure">
          <form action={createFeeStructureAction} className="space-y-3">
            <div><label className="label">Class</label>
              <select className="select" name="classId">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Name</label><input className="input" name="name" defaultValue="Annual" /></div>
            <div><label className="label">Frequency</label>
              <select className="select" name="frequency">
                <option>MONTHLY</option><option>QUARTERLY</option><option>ANNUAL</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Tuition</label><input className="input" name="tuition" type="number" defaultValue={5000} /></div>
              <div><label className="label">Transport</label><input className="input" name="transport" type="number" defaultValue={0} /></div>
              <div><label className="label">Lab</label><input className="input" name="lab" type="number" defaultValue={0} /></div>
              <div><label className="label">Activity</label><input className="input" name="activity" type="number" defaultValue={0} /></div>
              <div><label className="label">Exam</label><input className="input" name="exam" type="number" defaultValue={0} /></div>
              <div><label className="label">Misc</label><input className="input" name="misc" type="number" defaultValue={0} /></div>
            </div>
            <button className="btn-primary w-full">Create</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
