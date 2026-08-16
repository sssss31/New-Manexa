// Office-kiosk staff face attendance. Matches a face against the tenant's
// STAFF gallery (session-less) and records a daily StaffAttendance punch.
import { z } from "zod";
import { guard, json } from "@/lib/face/api-guard";
import { recognizeStaff } from "@/lib/face/engine";

export const runtime = "nodejs";

const Body = z.object({
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
  // High-frequency recognition loop; office kiosk is run by admin/principal/HR.
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "HR"], bucket: "staff-recognize", limit: 600 });
  if ("res" in g) return g.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, 422);
  try {
    const result = await recognizeStaff({ tenantId: g.ctx.tenantId, actorId: g.ctx.userId, ...parsed.data });
    return json(result);
  } catch (e: any) {
    return json({ error: e.message ?? "Recognition failed" }, 400);
  }
}
