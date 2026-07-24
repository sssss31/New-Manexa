import { guard, json } from "@/lib/face/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/face/analytics — dashboard rollups for the tenant
export async function GET(req: Request) {
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"], bucket: "analytics", limit: 120 });
  if ("res" in g) return g.res;
  const tenantId = g.ctx.tenantId;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [presentToday, lateToday, enrolled, totalStudents, decisions, latencyAgg, unknownOpen] = await Promise.all([
    prisma.faceAttendanceRecord.count({ where: { status: "PRESENT", recognizedAt: { gte: dayStart }, session: { tenantId } } }),
    prisma.faceAttendanceRecord.count({ where: { status: "LATE", recognizedAt: { gte: dayStart }, session: { tenantId } } }),
    prisma.faceProfile.count({ where: { tenantId, subjectType: "STUDENT", status: "ACTIVE", sampleCount: { gt: 0 } } }),
    prisma.student.count({ where: { tenantId, status: "ACTIVE", deletedAt: null } }),
    prisma.recognitionLog.groupBy({ by: ["decision"], where: { tenantId, at: { gte: dayStart } }, _count: true }),
    prisma.recognitionLog.aggregate({ where: { tenantId, at: { gte: dayStart } }, _avg: { latencyMs: true } }),
    prisma.unknownFace.count({ where: { tenantId, resolved: false } }),
  ]);

  const recognized = decisions.find((d) => d.decision === "RECOGNIZED")?._count ?? 0;
  const totalDecisions = decisions.reduce((s, d) => s + d._count, 0);
  const accuracy = totalDecisions ? Math.round((recognized / totalDecisions) * 100) : 0;

  return json({
    presentToday,
    lateToday,
    enrolled,
    totalStudents,
    enrolmentPct: totalStudents ? Math.round((enrolled / totalStudents) * 100) : 0,
    accuracy,
    avgLatencyMs: Math.round(latencyAgg._avg.latencyMs ?? 0),
    unknownOpen,
    decisions: Object.fromEntries(decisions.map((d) => [d.decision, d._count])),
  });
}
