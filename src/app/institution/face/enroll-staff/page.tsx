import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";

export default async function EnrollStaffIndex({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;

  const staff = await prisma.staff.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      ...(q ? { user: { displayName: { contains: q, mode: "insensitive" } } } : {}),
    },
    include: { user: true, faceProfile: { include: { _count: { select: { samples: true } } } } },
    orderBy: { employeeCode: "asc" },
    take: 80,
  });

  return (
    <>
      <PageHeader
        title="Staff face enrolment"
        sub="Register a teacher's or staff member's face. Quality-checked, encrypted at rest. The face is bound to the staff member — not to you."
        actions={<Link href="/institution/staff-attendance" className="btn-secondary">← Staff Attendance</Link>}
      />
      <SectionCard>
        <form method="get" className="flex flex-wrap gap-2 mb-4">
          <input className="input max-w-xs" name="q" defaultValue={q ?? ""} placeholder="Search staff…" />
          <button className="btn-secondary">Filter</button>
        </form>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Staff</th>
                <th className="th">Designation</th>
                <th className="th">Emp #</th>
                <th className="th">Enrolment</th>
                <th className="th">Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const samples = s.faceProfile?._count.samples ?? 0;
                return (
                  <tr key={s.id} className="row-hover">
                    <td className="td font-medium">{s.user.displayName}</td>
                    <td className="td text-muted">{s.designation}{s.department ? ` · ${s.department}` : ""}</td>
                    <td className="td font-mono text-xs">{s.employeeCode}</td>
                    <td className="td">
                      {samples > 0 ? <Tag tone="success">Enrolled</Tag> : <Tag tone="muted">Not enrolled</Tag>}
                    </td>
                    <td className="td">
                      <Link href={`/institution/face/enroll-staff/${s.id}`} className="badge badge-accent hover:bg-accent/20 transition-colors">
                        {samples > 0 ? "Re-enrol" : "Enrol face"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {staff.length === 0 && <div className="text-sm text-muted mt-3">No staff matched.</div>}
      </SectionCard>
    </>
  );
}
