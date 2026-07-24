import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function TeacherNotices() {
  const user = await requireRole("TEACHER");
  const notices = await prisma.notice.findMany({
    where: { tenantId: user.tenantId!, audience: { in: ["ALL", "STAFF"] } },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Notices" sub="Announcements from your institution" />
      <div className="space-y-3">
        {notices.length === 0 && <div className="card p-6 text-sm text-muted">No notices for you right now.</div>}
        {notices.map((n) => (
          <div key={n.id} className="card p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-fg font-medium">{n.title}</div>
                <div className="text-sm text-muted mt-1">{n.body}</div>
              </div>
              <div className="text-right">
                <Tag tone="accent">{n.audience}</Tag>
                <div className="text-xs text-muted mt-1">{relative(n.publishedAt)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
