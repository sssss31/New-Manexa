import { z } from "zod";
import { guard, json } from "@/lib/face/api-guard";
import { recognize } from "@/lib/face/engine";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().min(1),
  descriptor: z.array(z.number()).min(64).max(1024),
  livenessScore: z.number().min(0).max(100),
  quality: z.object({
    brightness: z.number(),
    sharpness: z.number(),
    faceCount: z.number(),
    faceBoxPx: z.number(),
    centered: z.boolean(),
    frameW: z.number(),
    frameH: z.number(),
  }),
  deviceInfo: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  // High-frequency endpoint — generous limit for a live recognition loop.
  const g = await guard(req, { roles: ["TEACHER", "INSTITUTION_ADMIN", "PRINCIPAL"], bucket: "recognize", limit: 600 });
  if ("res" in g) return g.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, 422);
  try {
    const result = await recognize({ tenantId: g.ctx.tenantId, ...parsed.data });
    return json(result);
  } catch (e: any) {
    return json({ error: e.message ?? "Recognition failed" }, 400);
  }
}
