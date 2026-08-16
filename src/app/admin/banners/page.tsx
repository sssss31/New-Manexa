import { prisma } from "@/lib/prisma";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { pct } from "@/lib/format";
import { createBannerAction, toggleBannerAction } from "../actions";

export default async function BannersPage() {
  const banners = await prisma.banner.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Banner campaigns" sub="Cross-tenant marketing · impressions/clicks/CTR" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {banners.length === 0 && (
            <div className="card p-6 text-sm text-muted">No banners yet. Create one on the right.</div>
          )}
          {banners.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-fg font-medium">{b.title}</div>
                  <div className="text-sm text-muted mt-1 max-w-xl">{b.body}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <Tag tone="accent">{b.audience}</Tag>
                    <StatusBadge status={b.status} />
                    <span className="text-xs text-muted">
                      {b.impressions.toLocaleString()} impressions · {b.clicks.toLocaleString()} clicks · CTR {b.impressions ? pct(b.clicks, b.impressions) : "—"}
                    </span>
                  </div>
                </div>
                <form action={toggleBannerAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn-secondary text-xs">{b.status === "ACTIVE" ? "Pause" : "Resume"}</button>
                </form>
              </div>
            </div>
          ))}
        </div>

        <SectionCard title="New campaign">
          <form action={createBannerAction} className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input className="input" name="title" required />
            </div>
            <div>
              <label className="label">Body</label>
              <textarea className="textarea" name="body" required />
            </div>
            <div>
              <label className="label">Audience</label>
              <select className="select" name="audience" defaultValue="ALL">
                <option>ALL</option>
                <option>PARENTS</option>
                <option>STUDENTS</option>
                <option>STAFF</option>
                <option>TENANT_ADMIN</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">CTA label</label>
                <input className="input" name="ctaLabel" placeholder="Learn more" />
              </div>
              <div>
                <label className="label">CTA link</label>
                <input className="input" name="ctaHref" placeholder="https://…" />
              </div>
            </div>
            <button className="btn-primary w-full">Publish banner</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
