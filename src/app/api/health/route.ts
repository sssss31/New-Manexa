import { prisma } from "@/lib/prisma";
import { logger, prismaErrorCode } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache health

const startedAt = Date.now();

// Human-readable meaning for the common connectivity codes. Codes/messages are
// safe to expose (no secrets, no host) and turn a production incident into a
// one-URL diagnosis: open /api/health in the browser.
const CODE_HELP: Record<string, string> = {
  P1000: "Authentication failed — wrong DB user/password in DATABASE_URL.",
  P1001: "Can't reach the database server — likely the Supabase DIRECT url (IPv6) from Vercel. Use the pooler url (port 6543).",
  P1002: "Database server reached but timed out.",
  P1010: "Access denied for the database user.",
  P1011: "TLS/SSL error — check sslmode in the connection string.",
  P1013: "Invalid connection string.",
  P1017: "Server closed the connection.",
  P2024: "Connection pool timeout — raise connection_limit or use the pooler.",
};

// Liveness + readiness. 200 when the DB answers; 503 with a diagnostic code when not.
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - started,
      runtime: "nodejs",
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? "0.1.0",
      env: process.env.NODE_ENV,
      time: new Date().toISOString(),
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    logger.error("health: database unreachable", e, { route: "GET /api/health", code });
    return Response.json(
      {
        status: "degraded",
        db: "down",
        prismaCode: code ?? null,
        reason: (code && CODE_HELP[code]) ?? "Database query failed. Check DATABASE_URL / DIRECT_URL and Supabase status.",
        latencyMs: Date.now() - started,
        env: process.env.NODE_ENV,
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
