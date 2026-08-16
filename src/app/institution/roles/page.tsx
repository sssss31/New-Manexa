import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";

// Permission matrix from SRS §4.2 — the runtime contract enforced by
// requireRole() on every layout + tenant scoping on every query.
const MATRIX: { module: string; cells: string[] }[] = [
  { module: "Tenant settings",     cells: ["✓", "R", "—", "—", "—", "—", "—"] },
  { module: "User management",     cells: ["✓", "✓", "A", "—", "—", "—", "—"] },
  { module: "LEAD / Admissions",   cells: ["R", "✓", "A", "—", "—", "—", "—"] },
  { module: "Student profile",     cells: ["R", "✓", "✓", "R", "R", "R-own", "R-own"] },
  { module: "Timetable",           cells: ["R", "✓", "✓", "R", "—", "R-own", "R-own"] },
  { module: "Attendance",          cells: ["R", "R", "R", "✓", "—", "R-own", "R-own"] },
  { module: "LMS content",         cells: ["R", "✓", "✓", "✓", "—", "—", "R"] },
  { module: "Examinations",        cells: ["R", "✓", "✓", "A", "—", "R-own", "R-own"] },
  { module: "Results",             cells: ["R", "A", "A", "A", "—", "R-own", "R-own"] },
  { module: "Fee structures",      cells: ["R", "✓", "A", "—", "✓", "—", "—"] },
  { module: "Fee collection",      cells: ["R", "R", "R", "—", "✓", "Pay", "—"] },
  { module: "Payroll",             cells: ["—", "R", "A", "R-self", "✓", "—", "—"] },
  { module: "Transport",           cells: ["R", "✓", "R", "—", "—", "R-own", "R-own"] },
  { module: "Hostel",              cells: ["R", "✓", "R", "—", "—", "R-own", "R-own"] },
  { module: "Library",             cells: ["R", "✓", "R", "R", "—", "R-own", "R-own"] },
  { module: "Notices",             cells: ["R", "✓", "✓", "✓", "R", "R", "R"] },
  { module: "AI insights",         cells: ["✓", "✓", "✓", "—", "—", "—", "—"] },
  { module: "Audit logs",          cells: ["✓", "R", "R", "—", "—", "—", "—"] },
];

const ROLE_COLS = ["Super Admin", "Inst. Admin", "Principal", "Teacher", "Accountant", "Parent", "Student"];

export default async function RolesPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const roleCounts = await prisma.user.groupBy({
    by: ["role"],
    where: { tenantId: user.tenantId! },
    _count: true,
  });

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        sub="RBAC enforced at every layout (requireRole) and every query (tenantId scope). ABAC attributes land with custom roles in Phase 3."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {roleCounts.map((r) => (
          <div key={r.role} className="card p-4">
            <div className="stat-label">{r.role.replace(/_/g, " ")}</div>
            <div className="stat-value">{r._count}</div>
            <div className="stat-sub">accounts in this institution</div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Permission matrix"
        right={
          <div className="flex gap-2 text-xs">
            <Tag tone="success">✓ full</Tag>
            <Tag>R read</Tag>
            <Tag tone="accent">A approve</Tag>
            <Tag tone="muted">— none</Tag>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="th">Module</th>
                {ROLE_COLS.map((r) => <th key={r} className="th">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.module} className="row-hover">
                  <td className="td font-medium">{row.module}</td>
                  {row.cells.map((c, i) => (
                    <td key={i} className={`td ${c === "✓" ? "text-accent font-semibold" : c === "—" ? "text-subtle" : "text-muted"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
