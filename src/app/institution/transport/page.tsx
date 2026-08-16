import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, StatusBadge } from "@/components/ui";
import { inr, dateShort } from "@/lib/format";

export default async function TransportPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const [vehicles, routes] = await Promise.all([
    prisma.vehicle.findMany({ where: { tenantId: user.tenantId! } }),
    prisma.route.findMany({
      where: { tenantId: user.tenantId! },
      include: { vehicle: true, allocations: true },
    }),
  ]);
  const totalAllocations = routes.reduce((s, r) => s + r.allocations.length, 0);
  return (
    <>
      <PageHeader title="Transport" sub="Fleet, routes, RFID, GPS (simulated in MVP)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Vehicles" value={vehicles.length} />
        <Stat label="Routes" value={routes.length} />
        <Stat label="Riders" value={totalAllocations} tone="accent" />
        <Stat label="Monthly revenue" value={inr(routes.reduce((s, r) => s + r.allocations.length * r.monthlyFare, 0))} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Vehicles">
          <table className="w-full">
            <thead>
              <tr><th className="th">Reg. No</th><th className="th">Driver</th><th className="th">Capacity</th><th className="th">Insurance</th><th className="th">Status</th></tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="row-hover">
                  <td className="td font-mono text-xs">{v.registration}</td>
                  <td className="td">{v.driverName}<div className="text-xs text-muted">{v.driverPhone}</div></td>
                  <td className="td tabular-nums">{v.capacity}</td>
                  <td className="td text-muted">{v.insuranceExpiry ? dateShort(v.insuranceExpiry) : "—"}</td>
                  <td className="td"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Routes">
          <table className="w-full">
            <thead>
              <tr><th className="th">Route</th><th className="th">Vehicle</th><th className="th">Stops</th><th className="th">Riders</th><th className="th">Fare</th></tr>
            </thead>
            <tbody>
              {routes.map((r) => {
                const stops = safeJSON(r.stops, []);
                return (
                  <tr key={r.id} className="row-hover">
                    <td className="td font-medium">{r.name}</td>
                    <td className="td font-mono text-xs">{r.vehicle.registration}</td>
                    <td className="td">{stops.length}</td>
                    <td className="td tabular-nums">{r.allocations.length}</td>
                    <td className="td tabular-nums">{inr(r.monthlyFare)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </>
  );
}

function safeJSON(s: string, fallback: any) {
  try { return JSON.parse(s); } catch { return fallback; }
}
