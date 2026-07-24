import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, StatusBadge, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function FaceDashboard() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [present, late, enrolled, totalStudents, decisions, latency, unknownOpen, openSessions, recentLogs, classAgg] =
    await Promise.all([
      prisma.faceAttendanceRecord.count({ where: { status: "PRESENT", recognizedAt: { gte: dayStart }, session: { tenantId } } }),
      prisma.faceAttendanceRecord.count({ where: { status: "LATE", recognizedAt: { gte: dayStart }, session: { tenantId } } }),
      prisma.faceProfile.count({ where: { tenantId, subjectType: "STUDENT", sampleCount: { gt: 0 } } }),
      prisma.student.count({ where: { tenantId, status: "ACTIVE", deletedAt: null } }),
      prisma.recognitionLog.groupBy({ by: ["decision"], where: { tenantId, at: { gte: dayStart } }, _count: true }),
      prisma.recognitionLog.aggregate({ where: { tenantId, at: { gte: dayStart } }, _avg: { latencyMs: true } }),
      prisma.unknownFace.count({ where: { tenantId, resolved: false } }),
      prisma.faceAttendanceSession.findMany({
        where: { tenantId, status: "OPEN" },
        include: { class: true, section: true, _count: { select: { records: true } } },
      }),
      prisma.recognitionLog.findMany({ where: { tenantId }, orderBy: { at: "desc" }, take: 10 }),
      prisma.faceAttendanceRecord.groupBy({
        by: ["sessionId"],
        where: { recognizedAt: { gte: dayStart }, session: { tenantId } },
        _count: true,
      }),
    ]);

  const totalDecisions = decisions.reduce((s, d) => s + d._count, 0);
  const recognized = decisions.find((d) => d.decision === "RECOGNIZED")?._count ?? 0;
  const accuracy = totalDecisions ? Math.round((recognized / totalDecisions) * 100) : 0;
  const enrolmentPct = totalStudents ? Math.round((enrolled / totalStudents) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Face Attendance"
        sub="Real-time recognition · encrypted embeddings · anti-spoof liveness. ArcFace inference backend pluggable."
        actions={
          <>
            <Link href="/institution/face/reports" className="btn-secondary">Reports</Link>
            <Link href="/institution/face/devices" className="btn-primary">Devices</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat label="Present today" value={present} tone="success" />
        <Stat label="Late today" value={late} tone={late ? "warning" : "default"} />
        <Stat label="Recognition accuracy" value={`${accuracy}%`} tone="accent" sub={`${totalDecisions} scans today`} />
        <Stat label="Avg latency" value={`${Math.round(latency._avg.latencyMs ?? 0)} ms`} sub="Target < 300 ms" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="stat-label">Enrolment</div>
          <div className="stat-value">{enrolmentPct}%</div>
          <div className="mt-2 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${enrolmentPct}%` }} />
          </div>
          <div className="stat-sub mt-2">{enrolled} of {totalStudents} students</div>
        </div>
        <Stat label="Open sessions" value={openSessions.length} tone={openSessions.length ? "accent" : "default"} />
        <Stat label="Unknown faces" value={unknownOpen} tone={unknownOpen ? "error" : "success"} />
        <Stat label="Scanned today" value={totalDecisions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Live sessions" className="lg:col-span-2" right={<Link href="/teacher/attendance/live" className="text-xs text-accent">Open live view →</Link>}>
          {openSessions.length === 0 && <div className="text-sm text-muted">No active sessions. Teachers start one from Live Attendance.</div>}
          <div className="space-y-2">
            {openSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between border border-border rounded-xl p-3">
                <div>
                  <div className="text-fg font-medium">{s.class.name} {s.section.name}</div>
                  <div className="text-xs text-muted">Started {relative(s.startedAt)} · threshold {s.threshold}%</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-accent">{s._count.records} marked</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recognition feed" right={<Link href="/institution/face/logs" className="text-xs text-accent">All logs</Link>}>
          <ul className="space-y-2">
            {recentLogs.length === 0 && <li className="text-sm text-muted">No recognition events yet.</li>}
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                <span className="text-sm">
                  <DecisionTag decision={l.decision} />
                </span>
                <span className="text-xs text-muted font-mono">{l.confidence}% · {l.latencyMs}ms · {relative(l.at)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        {["RECOGNIZED", "LOW_CONFIDENCE", "UNKNOWN", "SPOOF_REJECTED", "QUALITY_REJECTED"].map((d) => {
          const n = decisions.find((x) => x.decision === d)?._count ?? 0;
          return (
            <div key={d} className="card p-3 text-center">
              <div className="text-lg font-mono text-fg">{n}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{d.replace(/_/g, " ")}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DecisionTag({ decision }: { decision: string }) {
  const map: Record<string, "success" | "warning" | "error" | "muted"> = {
    RECOGNIZED: "success",
    LOW_CONFIDENCE: "warning",
    UNKNOWN: "error",
    SPOOF_REJECTED: "error",
    QUALITY_REJECTED: "muted",
  };
  return <Tag tone={map[decision] ?? "muted"}>{decision.replace(/_/g, " ")}</Tag>;
}
