import { requireRole } from "@/lib/auth";
import { EmptyState, KV, PageHeader, SectionCard, Tag } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";

export default async function ParentTransport() {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  const kid = kids[0];
  if (!kid) return <EmptyState title="No child linked" />;
  const alloc = kid.transportAlloc;
  return (
    <>
      <PageHeader title="Transport" sub={kid.user.displayName} />
      {!alloc ? (
        <EmptyState title="Transport not opted" sub="Contact the transport manager to opt in." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="Route">
            <KV k="Route" v={alloc.route.name} />
            <KV k="Vehicle" v={alloc.route.vehicle.registration} />
            <KV k="Driver" v={alloc.route.vehicle.driverName} />
            <KV k="Driver phone" v={alloc.route.vehicle.driverPhone} />
            <KV k="Your stop" v={alloc.stopName} />
          </SectionCard>
          <SectionCard title="Today's status">
            <div className="space-y-3">
              <div className="border border-border rounded-lg p-3">
                <div className="text-sm text-fg">Morning trip</div>
                <div className="text-xs text-muted">Estimated arrival at your stop: 7:42 AM</div>
                <div className="flex items-center gap-2 mt-2">
                  <Tag tone="success">On time</Tag>
                  <Tag tone="accent">RFID enabled</Tag>
                </div>
              </div>
              <div className="border border-border rounded-lg p-3">
                <div className="text-sm text-fg">Live tracking</div>
                <div className="text-xs text-muted">GPS feed is simulated in the MVP. In production the bus emits every 15 seconds via the transport-svc.</div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}
