import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TeacherTimetable() {
  const user = await requireRole("TEACHER");
  const staff = await prisma.staff.findUnique({ where: { userId: user.id } });
  if (!staff) return null;
  const entries = await prisma.timetableEntry.findMany({
    where: { teacherId: staff.id },
    include: { class: true, section: true, subject: true },
  });
  const periods = Array.from(new Set(entries.map((e) => e.period))).sort();
  return (
    <>
      <PageHeader title="My timetable" sub="Weekly view · substitute cover shown in production" />
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
                    const dow = di + 1;
                    const cell = entries.find((e) => e.period === p && e.dayOfWeek === dow);
                    return (
                      <td key={di} className="td">
                        {cell ? (
                          <div>
                            <div className="text-fg text-sm">{cell.subject.name}</div>
                            <div className="text-xs text-muted">{cell.class.name} {cell.section.name}</div>
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
