import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { dateTimeShort } from "@/lib/format";
import { createEventAction } from "../actions";

export default async function EventsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const events = await prisma.event.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { startsAt: "asc" },
  });
  const now = new Date();
  const upcoming = events.filter((e) => e.startsAt >= now);
  const past = events.filter((e) => e.startsAt < now).reverse();

  return (
    <>
      <PageHeader title="Events" sub="Institution calendar — creating an event notifies its audience" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title={`Upcoming · ${upcoming.length}`}>
            {upcoming.length === 0 && <div className="text-sm text-muted">Nothing scheduled.</div>}
            <div className="space-y-2">
              {upcoming.map((e) => (
                <div key={e.id} className="border border-border rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-fg font-medium">{e.title}</div>
                    {e.description && <div className="text-sm text-muted mt-0.5">{e.description}</div>}
                    <div className="text-xs text-muted mt-1.5">{e.venue ?? "Campus"} · {dateTimeShort(e.startsAt)}</div>
                  </div>
                  <Tag tone="accent">{e.audience}</Tag>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={`Past · ${past.length}`}>
            {past.length === 0 && <div className="text-sm text-muted">No past events.</div>}
            <ul className="space-y-1.5">
              {past.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between text-sm border-b border-border pb-1.5 last:border-0">
                  <span className="text-fg">{e.title}</span>
                  <span className="text-xs text-muted">{dateTimeShort(e.startsAt)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Create event">
          <form action={createEventAction} className="space-y-3">
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Description</label><textarea className="textarea" name="description" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Venue</label><input className="input" name="venue" placeholder="Main hall" /></div>
              <div>
                <label className="label">Audience</label>
                <select className="select" name="audience">
                  <option>ALL</option><option>PARENTS</option><option>STUDENTS</option><option>STAFF</option>
                </select>
              </div>
            </div>
            <div><label className="label">Starts at</label><input className="input" name="startsAt" type="datetime-local" required /></div>
            <button className="btn-primary w-full">Publish event</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
