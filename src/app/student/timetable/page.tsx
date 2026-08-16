import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function StudentTimetable() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id }, include: { class: true, section: true } });
  if (!student) return <EmptyState title="Not enrolled" />;
  const entries = await prisma.timetableEntry.findMany({
    where: { sectionId: student.sectionId },
    include: { subject: true, teacher: { include: { user: true } } },
  });
  const periods = Array.from(new Set(entries.map((e) => e.period))).sort();
  return (
    <>
      <PageHeader title="My timetable" sub={`${student.class.name} · ${student.section.name}`} />
      <SectionCard>
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
                    const cell = entries.find((e) => e.period === p && e.dayOfWeek === di + 1);
                    return (
                      <td key={di} className="td">
                        {cell ? (
                          <div>
                            <div className="text-fg text-sm">{cell.subject.name}</div>
                            <div className="text-xs text-muted">{cell.teacher?.user.displayName ?? "—"}</div>
                          </div>
                        ) : <span className="text-xs text-subtle">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
