import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Stat } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";

export default async function StaffPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const staff = await prisma.staff.findMany({
    where: { tenantId: user.tenantId! },
    include: { user: true },
    orderBy: { joiningDate: "desc" },
  });
  const totalCtc = staff.reduce((s, x) => s + x.ctcMonthly, 0);
  const active = staff.filter((x) => x.status === "ACTIVE").length;
  return (
    <>
      <PageHeader title="HR & staff" sub={`${staff.length} employees · lifecycle from onboarding to exit`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Employees" value={staff.length} />
        <Stat label="Active" value={active} tone="success" />
        <Stat label="Monthly CTC" value={inr(totalCtc)} tone="accent" />
        <Stat label="On leave" value={staff.filter((x) => x.status === "ON_LEAVE").length} tone="warning" />
      </div>
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Emp code</th>
              <th className="th">Name</th>
              <th className="th">Designation</th>
              <th className="th">Dept</th>
              <th className="th">Joined</th>
              <th className="th">CTC/mo</th>
              <th className="th">Leave bal</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="row-hover">
                <td className="td font-mono text-xs">{s.employeeCode}</td>
                <td className="td font-medium">{s.user.displayName}</td>
                <td className="td text-muted">{s.designation}</td>
                <td className="td text-muted">{s.department ?? "—"}</td>
                <td className="td text-muted">{dateShort(s.joiningDate)}</td>
                <td className="td tabular-nums">{inr(s.ctcMonthly)}</td>
                <td className="td tabular-nums">{s.leaveBalance}</td>
                <td className="td"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
