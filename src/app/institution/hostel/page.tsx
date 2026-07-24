import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag } from "@/components/ui";
import { allocateHostelAction, createHostelRoomAction } from "../actions";

export default async function HostelPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [rooms, unallocated] = await Promise.all([
    prisma.hostelRoom.findMany({
      where: { tenantId },
      include: { allocations: { include: { student: { include: { user: true, class: true } } } } },
      orderBy: [{ block: "asc" }, { number: "asc" }],
    }),
    prisma.student.findMany({
      where: { tenantId, status: "ACTIVE", hostelAllocation: null },
      include: { user: true, class: true, section: true },
      orderBy: { rollNo: "asc" },
      take: 100,
    }),
  ]);
  const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = rooms.reduce((s, r) => s + r.allocations.length, 0);
  const occupancyPct = capacity ? Math.round((occupied / capacity) * 100) : 0;

  return (
    <>
      <PageHeader title="Hostel" sub="Blocks, rooms, allotments · mess & out-pass land in Phase 3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Rooms" value={rooms.length} />
        <Stat label="Capacity" value={capacity} />
        <Stat label="Boarders" value={occupied} tone="accent" />
        <Stat label="Occupancy" value={`${occupancyPct}%`} tone={occupancyPct > 90 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Rooms" className="lg:col-span-2">
          {rooms.length === 0 && <div className="text-sm text-muted">No rooms yet — add the first one on the right.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rooms.map((r) => (
              <div key={r.id} className="border border-border rounded-2xl p-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-fg font-medium">Block {r.block} · Room {r.number}</div>
                  <Tag tone={r.allocations.length >= r.capacity ? "warning" : "success"}>
                    {r.allocations.length}/{r.capacity}
                  </Tag>
                </div>
                <div className="text-xs text-muted mt-0.5">{r.type === "AC" ? "Air-conditioned" : "Non-AC"}</div>
                <ul className="mt-3 space-y-1">
                  {r.allocations.map((a) => (
                    <li key={a.id} className="text-sm text-fg flex justify-between">
                      <span>{a.student.user.displayName}</span>
                      <span className="text-xs text-muted">{a.student.class.name}</span>
                    </li>
                  ))}
                  {r.allocations.length === 0 && <li className="text-xs text-subtle">Empty</li>}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Allocate a boarder">
            <form action={allocateHostelAction} className="space-y-3">
              <div>
                <label className="label">Student</label>
                <select className="select" name="studentId" required>
                  <option value="">Select…</option>
                  {unallocated.map((s) => (
                    <option key={s.id} value={s.id}>{s.user.displayName} · {s.class.name} {s.section.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Room</label>
                <select className="select" name="roomId" required>
                  <option value="">Select…</option>
                  {rooms.filter((r) => r.allocations.length < r.capacity).map((r) => (
                    <option key={r.id} value={r.id}>Block {r.block} · {r.number} ({r.capacity - r.allocations.length} free)</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full">Allocate</button>
            </form>
          </SectionCard>

          <SectionCard title="Add room">
            <form action={createHostelRoomAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Block</label><input className="input" name="block" placeholder="A" required /></div>
                <div><label className="label">Number</label><input className="input" name="number" placeholder="104" required /></div>
                <div><label className="label">Capacity</label><input className="input" name="capacity" type="number" defaultValue={4} min={1} /></div>
                <div>
                  <label className="label">Type</label>
                  <select className="select" name="type"><option>NON_AC</option><option>AC</option></select>
                </div>
              </div>
              <button className="btn-secondary w-full">Add room</button>
            </form>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
