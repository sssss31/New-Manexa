import { z } from "zod";
import { guard, json } from "@/lib/face/api-guard";
import { startSession, stopSession } from "@/lib/face/engine";
import { prisma } from "@/lib/prisma";

const StartBody = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().optional(),
  period: z.coerce.number().int().optional(),
  deviceId: z.string().optional(),
  threshold: z.coerce.number().int().min(50).max(99).optional(),
});

// POST /api/face/session — start (or reuse) an open session
export async function POST(req: Request) {
  const g = await guard(req, { roles: ["TEACHER", "INSTITUTION_ADMIN", "PRINCIPAL"], bucket: "session", limit: 60 });
  if ("res" in g) return g.res;
  const parsed = StartBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, 422);
  // Verify the class/section belongs to this tenant (multi-tenant isolation).
  const section = await prisma.section.findFirst({
    where: { id: parsed.data.sectionId, classId: parsed.data.classId, tenantId: g.ctx.tenantId },
  });
  if (!section) return json({ error: "Class/section not found" }, 404);
  const session = await startSession({ tenantId: g.ctx.tenantId, actorId: g.ctx.userId, ...parsed.data });
  return json({ ok: true, sessionId: session.id, threshold: session.threshold, startedAt: session.startedAt });
}

// DELETE /api/face/session?id=... — stop a session
export async function DELETE(req: Request) {
  const g = await guard(req, { roles: ["TEACHER", "INSTITUTION_ADMIN", "PRINCIPAL"], bucket: "session", limit: 60 });
  if ("res" in g) return g.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 422);
  const owned = await prisma.faceAttendanceSession.findFirst({ where: { id, tenantId: g.ctx.tenantId } });
  if (!owned) return json({ error: "Not found" }, 404);
  await stopSession({ tenantId: g.ctx.tenantId, actorId: g.ctx.userId, sessionId: id });
  return json({ ok: true });
}
