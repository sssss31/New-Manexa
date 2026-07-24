import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { relative } from "@/lib/format";
import { postNoticeAction } from "../actions";

export default async function NoticesPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const notices = await prisma.notice.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return (
    <>
      <PageHeader title="Notices" sub="Institution-wide, class-scoped, or role-scoped" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {notices.length === 0 && <div className="card p-6 text-sm text-muted">No notices yet.</div>}
          {notices.map((n) => (
            <div key={n.id} className="card p-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-fg font-medium">{n.title}</div>
                  <div className="text-sm text-muted mt-1 whitespace-pre-wrap max-w-2xl">{n.body}</div>
                </div>
                <div className="text-right">
                  <Tag tone="accent">{n.audience}</Tag>
                  <div className="text-xs text-muted mt-1">{relative(n.publishedAt)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <SectionCard title="New notice">
          <form action={postNoticeAction} className="space-y-3">
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Body</label><textarea className="textarea" name="body" required /></div>
            <div><label className="label">Audience</label>
              <select className="select" name="audience" defaultValue="ALL">
                <option>ALL</option><option>PARENTS</option><option>STAFF</option><option>CLASS</option>
              </select>
            </div>
            <button className="btn-primary w-full">Publish</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
