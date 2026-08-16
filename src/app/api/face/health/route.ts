import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Liveness/readiness for the face subsystem: DB + engine reachability.
// Anonymous callers get a bare ok/degraded (uptime probes); counts are
// tenant-scoped and only for signed-in staff — the old platform-wide counts
// leaked business metrics to the internet.
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const base = {
      status: "ok" as const,
      subsystem: "face-attendance",
      engine: "browser-descriptor-v1",
      checkMs: Date.now() - started,
      time: new Date().toISOString(),
    };

    const user = await getCurrentUser().catch(() => null);
    if (!user?.tenantId) return Response.json(base);

    const [profiles, openSessions] = await Promise.all([
      prisma.faceProfile.count({ where: { tenantId: user.tenantId } }),
      prisma.faceAttendanceSession.count({ where: { tenantId: user.tenantId, status: "OPEN" } }),
    ]);
    return Response.json({ ...base, enrolledProfiles: profiles, openSessions });
  } catch {
    return Response.json({ status: "degraded", subsystem: "face-attendance" }, { status: 503 });
  }
}
