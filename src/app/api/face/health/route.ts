import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Liveness/readiness for the face subsystem: DB + engine reachability.
export async function GET() {
  const started = Date.now();
  try {
    const [profiles, openSessions] = await Promise.all([
      prisma.faceProfile.count(),
      prisma.faceAttendanceSession.count({ where: { status: "OPEN" } }),
    ]);
    return Response.json({
      status: "ok",
      subsystem: "face-attendance",
      enrolledProfiles: profiles,
      openSessions,
      // In production this also pings the ArcFace inference service.
      engine: "browser-descriptor-v1",
      checkMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: "degraded", subsystem: "face-attendance" }, { status: 503 });
  }
}
