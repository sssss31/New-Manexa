import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { createSubjectAction } from "../actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SubjectsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [subjects, timetables, classes] = await Promise.all([
    prisma.subject.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.timetableEntry.findMany({
      where: { tenantId },
      include: { class: true, section: true, subject: true, teacher: { include: { user: true } } },
      take: 200,
    }),
    prisma.class.findMany({ where: { tenantId }, include: { sections: true }, orderBy: { name: "asc" } }),
  ]);

  const firstClass = classes[0];
  const firstSection = firstClass?.sections[0];
  const tt = firstClass && firstSection
    ? timetables.filter((t) => t.classId === firstClass.id && t.sectionId === firstSection.id)
    : [];
  const periods = Array.from(new Set(tt.map((t) => t.period))).sort();

  return (
    <>
      <PageHeader title="Subjects & timetable" sub="Curriculum + weekly schedule" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Subjects" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between border border-border rounded-lg px-3 py-2">
                <div>
                  <div className="text-fg text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted font-mono">{s.code}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Add subject">
          <form action={createSubjectAction} className="space-y-3">
            <div><label className="label">Code</label><input className="input" name="code" placeholder="MATH" required /></div>
            <div><label className="label">Name</label><input className="input" name="name" placeholder="Mathematics" required /></div>
            <button className="btn-primary w-full">Add subject</button>
          </form>
        </SectionCard>
      </div>

      {firstClass && firstSection && (
        <SectionCard title={`Sample timetable — ${firstClass.name} ${firstSection.name}`} className="mt-4">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="th">Period</th>
                  {DAYS.map((d, i) => <th key={i} className="th">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p}>
                    <td className="td text-xs text-muted">P{p}</td>
                    {DAYS.map((_, di) => {
                      const dow = di + 1;
                      const cell = tt.find((t) => t.period === p && t.dayOfWeek === dow);
                      return (
                        <td key={di} className="td">
                          {cell ? (
                            <div>
                              <div className="text-fg text-sm">{cell.subject.name}</div>
                              <div className="text-xs text-muted">{cell.teacher?.user.displayName ?? "—"}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-subtle">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}
