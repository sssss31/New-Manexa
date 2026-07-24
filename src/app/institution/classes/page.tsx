import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { createClassAction } from "../actions";

export default async function ClassesPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const classes = await prisma.class.findMany({
    where: { tenantId: user.tenantId! },
    include: {
      sections: { include: { _count: { select: { students: true } } } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Classes & sections" sub="Academic taxonomy of the institution" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {classes.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-fg font-medium">{c.name}</div>
                  <div className="text-xs text-muted">{c.stream ?? "General"} · {c._count.students} students</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {c.sections.map((s) => (
                  <div key={s.id} className="flex justify-between items-baseline text-sm">
                    <span className="text-fg">Section {s.name}</span>
                    <span className="text-xs text-muted">{s._count.students}/{s.capacity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SectionCard title="Add class">
          <form action={createClassAction} className="space-y-3">
            <div><label className="label">Name</label><input className="input" name="name" placeholder="Class VIII" required /></div>
            <div><label className="label">Stream (optional)</label><input className="input" name="stream" placeholder="Science" /></div>
            <div><label className="label">Sections (comma separated)</label><input className="input" name="sections" defaultValue="A,B" /></div>
            <button className="btn-primary w-full">Create class</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
