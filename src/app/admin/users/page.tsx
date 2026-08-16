import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Users" sub={`${users.length} accounts across all tenants (including platform)`} />
      <SectionCard>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">User</th>
              <th className="th">Role</th>
              <th className="th">Tenant</th>
              <th className="th">Status</th>
              <th className="th">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="row-hover">
                <td className="td">
                  <div className="font-medium text-fg">{u.displayName}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="td"><Tag tone={u.role === "SUPER_ADMIN" ? "accent" : "muted"}>{u.role.replace(/_/g, " ")}</Tag></td>
                <td className="td text-muted">{u.tenant?.name ?? "—"}</td>
                <td className="td"><StatusBadge status={u.status} /></td>
                <td className="td text-xs text-muted">{u.lastLoginAt ? relative(u.lastLoginAt) : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
