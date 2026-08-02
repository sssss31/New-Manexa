import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { normalizeDate } from "@/lib/engine";
import { PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { timeOnly } from "@/lib/format";
import { StaffRecognizer } from "@/components/face/StaffRecognizer";

function hoursLabel(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default async function StaffAttendancePage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const today = normalizeDate(new Date());

  const [staff, records, enrolled] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId, status: "ACTIVE" },
      include: { user: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.staffAttendance.findMany({ where: { tenantId, date: today } }),
    prisma.faceProfile.count({ where: { tenantId, subjectType: "STAFF", status: "ACTIVE" } }),
  ]);

  const byStaff = new Map(records.map((r) => [r.staffId, r]));
  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const notMarked = staff.length - byStaff.size;

  return (
    <>
      <PageHeader
        title="Staff Attendance"
        sub="AI face attendance for teachers & non-teaching staff — office-kiosk mode"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Stat label="Active staff" value={staff.length} />
        <Stat label="Present today" value={present} tone="success" />
        <Stat label="Late" value={late} tone={late ? "warning" : "default"} />
        <Stat label="Faces enrolled" value={`${enrolled}/${staff.length}`} tone="accent" />
      </div>

      <SectionCard title="Office kiosk" className="mb-6">
        <p className="text-sm text-muted mb-4">
          Point an office / gate camera at staff as they arrive. Each recognition records a punch —
          the first is check-in, later ones extend working hours. Enrol staff faces first from{" "}
          <span className="text-accent">Face Attendance → Enrolment</span>.
        </p>
        <StaffRecognizer />
      </SectionCard>

      <SectionCard title={`Today · ${staff.length} staff · ${notMarked} not marked`}>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="th">Employee</th>
                <th className="th">Dept</th>
                <th className="th">Status</th>
                <th className="th">First in</th>
                <th className="th">Last out</th>
                <th className="th">Worked</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const r = byStaff.get(s.id);
                return (
                  <tr key={s.id} className="row-hover">
                    <td className="td">
                      <div className="font-medium text-fg">{s.user.displayName}</div>
                      <div className="text-xs text-muted">{s.employeeCode} · {s.designation}</div>
                    </td>
                    <td className="td text-sm text-muted">{s.department ?? "—"}</td>
                    <td className="td">{r ? <StatusBadge status={r.status} /> : <span className="text-xs text-muted">not marked</span>}</td>
                    <td className="td font-mono text-sm">{r?.firstInAt ? timeOnly(r.firstInAt) : "—"}</td>
                    <td className="td font-mono text-sm">{r?.lastOutAt ? timeOnly(r.lastOutAt) : "—"}</td>
                    <td className="td font-mono text-sm">{r ? hoursLabel(r.workedMinutes) : "—"}</td>
                  </tr>
                );
              })}
              {staff.length === 0 && (
                <tr><td className="td text-sm text-muted" colSpan={6}>No active staff yet — add staff from Staff (HR).</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
