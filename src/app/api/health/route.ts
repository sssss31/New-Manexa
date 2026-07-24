import { prisma } from "@/lib/prisma";

const startedAt = Date.now();

// Liveness + readiness for the k8s probes in k8s/manexa.yaml.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "up",
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
