import { z } from "zod";
import { guard, json } from "@/lib/face/api-guard";
import { resolveUnknown } from "@/lib/face/engine";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/face/unknown — list unresolved unknown faces
export async function GET(req: Request) {
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"], bucket: "unknown", limit: 120 });
  if ("res" in g) return g.res;
  const list = await prisma.unknownFace.findMany({
    where: { tenantId: g.ctx.tenantId, resolved: false },
    orderBy: { seenAt: "desc" },
    take: 100,
    // NB: embedding intentionally NOT selected — never exposed to the client.
    select: { id: true, bestScore: true, seenAt: true, sessionId: true },
  });
  return json({ count: list.length, unknown: list });
}

// PATCH /api/face/unknown — resolve an unknown face
const PatchBody = z.object({
  unknownId: z.string().min(1),
  resolution: z.enum(["IGNORED", "REGISTERED", "RETRIED"]),
});
export async function PATCH(req: Request) {
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"], bucket: "unknown", limit: 120 });
  if ("res" in g) return g.res;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, 422);
  await resolveUnknown({ tenantId: g.ctx.tenantId, actorId: g.ctx.userId, ...parsed.data });
  return json({ ok: true });
}
