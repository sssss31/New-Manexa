import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag, EmptyState } from "@/components/ui";
import { relative } from "@/lib/format";
import { approveJoinAction, rejectJoinAction } from "../actions";

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Teacher", HR: "HR", LIBRARIAN: "Librarian", TRANSPORT_MGR: "Transport Mgr",
  ACCOUNTANT: "Accountant", PARENT: "Parent",
};

export default async function JoinRequestsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;

  const pending = await prisma.user.findMany({
    where: { tenantId, status: "PENDING" },
    include: { staff: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byRole = pending.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Join Requests"
        sub="Review and onboard people who requested to join your institution"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        <Stat label="Total pending" value={pending.length} tone={pending.length ? "warning" : "default"} />
        {["TEACHER", "ACCOUNTANT", "LIBRARIAN", "PARENT"].map((r) => (
          <Stat key={r} label={ROLE_LABEL[r] ?? r} value={byRole[r] ?? 0} />
        ))}
      </div>

      <SectionCard title={`Pending approvals · ${pending.length}`}>
        {pending.length === 0 ? (
          <EmptyState
            title="No pending requests"
            sub="When teachers, staff or parents request to join with your Institution ID, they'll appear here for approval."
          />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="th">Person</th>
                  <th className="th">Role</th>
                  <th className="th">Requested</th>
                  <th className="th">Onboard as</th>
                  <th className="th text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="row-hover align-top">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                          {p.displayName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-fg">{p.displayName}</div>
                          <div className="text-xs text-muted truncate">{p.email}</div>
                          {p.phone && <div className="text-xs text-muted">{p.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <Tag>{ROLE_LABEL[p.role] ?? p.role}</Tag>
                      {p.staff && <div className="text-xs text-muted mt-1">{p.staff.employeeCode}</div>}
                    </td>
                    <td className="td text-sm text-muted">{relative(p.createdAt)}</td>
                    <td className="td">
                      {p.staff ? (
                        <form id={`approve-${p.id}`} action={approveJoinAction} className="space-y-2">
                          <input type="hidden" name="userId" value={p.id} />
                          <input className="input py-1 text-sm" name="department" placeholder="Department" defaultValue={p.staff.department ?? ""} />
                          <input className="input py-1 text-sm" name="designation" placeholder="Designation" defaultValue={p.staff.designation} />
                        </form>
                      ) : (
                        <form id={`approve-${p.id}`} action={approveJoinAction}>
                          <input type="hidden" name="userId" value={p.id} />
                          <span className="text-xs text-muted">Parent / guardian</span>
                        </form>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex flex-col items-end gap-2">
                        <button type="submit" form={`approve-${p.id}`} className="btn-primary text-xs w-full max-w-[150px]">✅ Approve &amp; activate</button>
                        <form action={rejectJoinAction} className="flex items-center gap-1.5 w-full max-w-[150px]">
                          <input type="hidden" name="userId" value={p.id} />
                          <input className="input py-1 text-xs" name="reason" placeholder="Reason" required />
                          <button type="submit" className="btn-danger text-xs shrink-0">Reject</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
