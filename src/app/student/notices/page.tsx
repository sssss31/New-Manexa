import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function StudentNotices() {
  const user = await requireRole("STUDENT");
  const notices = await prisma.notice.findMany({
    where: { tenantId: user.tenantId!, audience: { in: ["ALL", "CLASS"] } },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Notices" />
      <div className="space-y-3">
        {notices.map((n) => (
          <div key={n.id} className="card p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-fg font-medium">{n.title}</div>
                <div className="text-sm text-muted mt-1 whitespace-pre-wrap">{n.body}</div>
              </div>
              <div className="text-right">
                <Tag tone="accent">{n.audience}</Tag>
                <div className="text-xs text-muted mt-1">{relative(n.publishedAt)}</div>
              </div>
            </div>
          </div>
        ))}
        {notices.length === 0 && <div className="card p-6 text-sm text-muted">No notices yet.</div>}
      </div>
    </>
  );
}
