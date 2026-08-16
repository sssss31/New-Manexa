// Teacher / staff self check-in by face. The caller is already authenticated;
// this endpoint verifies the presented face against the CALLER'S OWN enrolled
// template (1:1) and records their StaffAttendance punch. The staff identity is
// resolved SERVER-SIDE from the session — never taken from the request body — so
// nobody can punch attendance for another person or another institution.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guard, json } from "@/lib/face/api-guard";
import { selfCheckInByFace } from "@/lib/face/engine";

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
  // Any staff-shaped role may self check-in; the staff record below is the real
  // gate (a caller without one is rejected regardless of role).
  const g = await guard(req, {
    roles: ["TEACHER", "INSTITUTION_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
    bucket: "self-attendance",
    limit: 600,
  });
  if ("res" in g) return g.res;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body" }, 422);

  // Resolve the caller's OWN staff record from the authenticated context.
  const staff = await prisma.staff.findFirst({
    where: { userId: g.ctx.userId, tenantId: g.ctx.tenantId, status: "ACTIVE" },
    include: { user: { select: { displayName: true } } },
  });
  if (!staff) {
    return json({ error: "No active staff record is linked to your account." }, 403);
  }

  try {
    const result = await selfCheckInByFace({
      tenantId: g.ctx.tenantId,
      actorId: g.ctx.userId,
      staffId: staff.id,
      name: staff.user.displayName,
      ...parsed.data,
    });
    return json(result);
  } catch (e: any) {
    return json({ error: e?.message ?? "Attendance failed" }, 400);
  }
}
