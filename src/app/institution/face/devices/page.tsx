import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Stat, Tag } from "@/components/ui";
import { relative } from "@/lib/format";
import { createDeviceAction, toggleDeviceAction } from "../actions";

export default async function DevicesPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const devices = await prisma.attendanceDevice.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });
  const online = devices.filter((d) => d.status === "ONLINE").length;

  return (
    <>
      <PageHeader title="Attendance devices" sub="Cameras & capture points. CCTV / gate / bus kinds are future-ready endpoints." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Devices" value={devices.length} />
        <Stat label="Online" value={online} tone="success" />
        <Stat label="Sessions run" value={devices.reduce((s, d) => s + d._count.sessions, 0)} tone="accent" />
        <Stat label="Kinds" value={new Set(devices.map((d) => d.kind)).size} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Registered devices" className="lg:col-span-2">
          <table className="w-full">
            <thead>
              <tr><th className="th">Name</th><th className="th">Kind</th><th className="th">Location</th><th className="th">Last seen</th><th className="th">Status</th><th className="th"></th></tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="row-hover">
                  <td className="td font-medium">{d.name}</td>
                  <td className="td"><Tag tone={d.kind === "CCTV" || d.kind === "GATE" || d.kind === "BUS" ? "accent" : "muted"}>{d.kind}</Tag></td>
                  <td className="td text-muted">{d.location ?? "—"}</td>
                  <td className="td text-xs text-muted">{d.lastSeenAt ? relative(d.lastSeenAt) : "never"}</td>
                  <td className="td"><StatusBadge status={d.status} /></td>
                  <td className="td">
                    <form action={toggleDeviceAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn-ghost text-xs">{d.status === "DISABLED" ? "Enable" : "Disable"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {devices.length === 0 && <div className="text-sm text-muted">No devices yet — add one on the right.</div>}
        </SectionCard>

        <SectionCard title="Add device">
          <form action={createDeviceAction} className="space-y-3">
            <div><label className="label">Name</label><input className="input" name="name" placeholder="Class VI-A Camera" required /></div>
            <div>
              <label className="label">Kind</label>
              <select className="select" name="kind">
                <option value="WEBCAM">Webcam / Laptop</option>
                <option value="EXTERNAL">External camera</option>
                <option value="CCTV">CCTV stream</option>
                <option value="GATE">School gate</option>
                <option value="BUS">Bus</option>
              </select>
            </div>
            <div><label className="label">Location</label><input className="input" name="location" placeholder="Block A · Room 101" /></div>
            <button className="btn-primary w-full">Register device</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
