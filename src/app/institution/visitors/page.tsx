import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, StatusBadge, EmptyState } from "@/components/ui";
import { relative } from "@/lib/format";
import { checkInAction, checkOutAction } from "./actions";

export const dynamic = "force-dynamic";

function timeOf(d: Date) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const sp = await searchParams;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [visitors, currentlyIn, todayCount] = await Promise.all([
    prisma.visitor.findMany({ where: { tenantId }, orderBy: [{ status: "asc" }, { checkInAt: "desc" }], take: 60 }),
    prisma.visitor.count({ where: { tenantId, status: "IN" } }),
    prisma.visitor.count({ where: { tenantId, checkInAt: { gte: startOfDay } } }),
  ]);

  return (
    <>
      <PageHeader title="Visitor management" sub="Digital reception — check-in & check-out" />
      {sp.err && <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error" role="alert">{decodeURIComponent(sp.err)}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="On premises" value={currentlyIn} tone={currentlyIn > 0 ? "accent" : "default"} />
        <Stat label="Today" value={todayCount} />
        <Stat label="Total logged" value={visitors.length} />
      </div>

      {/* Check-in */}
      <SectionCard className="mb-6">
        <div className="text-sm font-semibold text-fg mb-3">Register a visitor</div>
        <form action={checkInAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label><span className="label">Name</span><input name="name" required placeholder="Visitor name" className="input" /></label>
          <label><span className="label">Phone</span><input name="phone" inputMode="tel" placeholder="Optional" className="input" /></label>
          <label><span className="label">Purpose</span><input name="purpose" required placeholder="e.g. Admission enquiry" className="input" /></label>
          <label><span className="label">Host / to meet</span><input name="host" placeholder="Optional" className="input" /></label>
          <div className="lg:col-span-4"><button className="btn-primary">Check in</button></div>
        </form>
      </SectionCard>

      {/* Log */}
      <SectionCard>
        <div className="text-sm font-semibold text-fg mb-1">Visitor log</div>
        {visitors.length === 0 ? (
          <EmptyState title="No visitors yet" sub="Register your first visitor above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">Pass</th><th className="th">Visitor</th><th className="th">Purpose</th>
                <th className="th">Host</th><th className="th">In</th><th className="th">Out</th><th className="th">Status</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.id} className="row-hover">
                    <td className="td font-mono text-xs text-muted">{v.passNo}</td>
                    <td className="td text-fg">{v.name}{v.phone ? <span className="text-xs text-subtle"> · {v.phone}</span> : null}</td>
                    <td className="td text-muted">{v.purpose}</td>
                    <td className="td text-muted">{v.host || "—"}</td>
                    <td className="td text-muted whitespace-nowrap">{timeOf(v.checkInAt)} · {relative(v.checkInAt)}</td>
                    <td className="td text-muted whitespace-nowrap">{v.checkOutAt ? timeOf(v.checkOutAt) : "—"}</td>
                    <td className="td"><StatusBadge status={v.status === "IN" ? "IN" : "OUT"} /></td>
                    <td className="td text-right">
                      {v.status === "IN" && (
                        <form action={checkOutAction}>
                          <input type="hidden" name="id" value={v.id} />
                          <button className="btn-secondary text-xs">Check out</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
