import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { normalizeDate } from "@/lib/engine";
import { markAttendanceAction } from "../actions";

export default async function TeacherAttendance({ searchParams }: { searchParams: Promise<{ sectionId?: string }> }) {
  const sp = await searchParams;
  const user = await requireRole("TEACHER");
  const staff = await prisma.staff.findUnique({ where: { userId: user.id } });

  const sections = staff
    ? await prisma.section.findMany({
        where: { timetables: { some: { teacherId: staff.id } } },
        include: { class: true, _count: { select: { students: true } } },
      })
    : [];

  const activeSectionId = sp.sectionId ?? sections[0]?.id;
  // Tenant-scoped + active-only: sectionId comes from the URL, so without the
  // tenant filter any teacher could render another institution's roster.
  const students = activeSectionId
    ? await prisma.student.findMany({
        where: { sectionId: activeSectionId, tenantId: user.tenantId!, status: "ACTIVE", deletedAt: null },
        include: { user: true, attendance: { where: { date: normalizeDate(new Date()) }, take: 1 } },
        orderBy: { rollNo: "asc" },
      })
    : [];

  return (
    <>
      <PageHeader title="Attendance" sub="Roll out attendance for today · offline-safe queue in prod" />
      <div className="flex gap-2 flex-wrap mb-4">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`/teacher/attendance?sectionId=${s.id}`}
            className={`btn-secondary ${activeSectionId === s.id ? "border-accent text-accent" : ""}`}
          >
            {s.class.name} {s.name} <span className="text-xs text-muted ml-1">({s._count.students})</span>
          </Link>
        ))}
      </div>

      {activeSectionId && students.length > 0 && (
        <SectionCard title={`Class roster · ${students.length} students`}>
          <form action={markAttendanceAction}>
            <input type="hidden" name="sectionId" value={activeSectionId} />
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Roll</th>
                  <th className="th">Student</th>
                  <th className="th">Adm #</th>
                  <th className="th">Status</th>
                  <th className="th">Existing</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="row-hover">
                    <td className="td font-mono">{s.rollNo ?? "—"}</td>
                    <td className="td">{s.user.displayName}</td>
                    <td className="td font-mono text-xs">{s.admissionNo}</td>
                    <td className="td">
                      <select name={`s_${s.id}`} className="select w-32 py-1" defaultValue={s.attendance[0]?.status ?? "PRESENT"}>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="LEAVE">Leave</option>
                      </select>
                    </td>
                    <td className="td">{s.attendance[0] ? <StatusBadge status={s.attendance[0].status} /> : <span className="text-xs text-muted">unmarked</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" type="submit">Submit attendance</button>
            </div>
          </form>
        </SectionCard>
      )}

      {activeSectionId && students.length === 0 && (
        <SectionCard>
          <div className="text-sm text-muted">No students in this section.</div>
        </SectionCard>
      )}
    </>
  );
}
