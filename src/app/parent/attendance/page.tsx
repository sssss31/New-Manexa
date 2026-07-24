import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Stat, EmptyState } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { dateShort } from "@/lib/format";

export default async function ParentAttendance() {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  const kid = kids[0];
  if (!kid) return <EmptyState title="No child linked" />;
  const attendance = await prisma.attendance.findMany({
    where: { studentId: kid.id },
    orderBy: { date: "desc" },
    take: 60,
  });
  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const late = attendance.filter((a) => a.status === "LATE").length;
  const leave = attendance.filter((a) => a.status === "LEAVE").length;
  const pct = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  return (
    <>
      <PageHeader title="Attendance" sub={`${kid.user.displayName} · last ${attendance.length} days`} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Overall %" value={`${pct}%`} tone={pct >= 75 ? "success" : "warning"} />
        <Stat label="Present" value={present} />
        <Stat label="Absent" value={absent} tone="error" />
        <Stat label="Late" value={late} />
        <Stat label="Leave" value={leave} />
      </div>
      <SectionCard>
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Status</th><th className="th">Reason</th></tr></thead>
          <tbody>
            {attendance.map((a) => (
              <tr key={a.id} className="row-hover">
                <td className="td">{dateShort(a.date)}</td>
                <td className="td"><StatusBadge status={a.status} /></td>
                <td className="td text-muted">{a.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
