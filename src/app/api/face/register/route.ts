import { z } from "zod";
import { guard, json } from "@/lib/face/api-guard";
import { enrollSample } from "@/lib/face/engine";
import { POSES } from "@/lib/face/descriptor";

const Body = z.object({
  subjectType: z.enum(["STUDENT", "STAFF"]),
  subjectId: z.string().min(1),
  pose: z.enum(POSES),
  descriptor: z.array(z.number()).min(64).max(1024),
  quality: z.object({
    brightness: z.number(),
    sharpness: z.number(),
    faceCount: z.number(),
    faceBoxPx: z.number(),
    centered: z.boolean(),
    frameW: z.number(),
    frameH: z.number(),
  }),
});

export async function POST(req: Request) {
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"], bucket: "register", limit: 60 });
  if ("res" in g) return g.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid body", issues: parsed.error.flatten() }, 422);

  // A teacher may only enrol their own STAFF face; admins/principals enrol students.
  if (g.ctx.role === "TEACHER" && parsed.data.subjectType === "STUDENT") {
    return json({ error: "Teachers cannot enrol student faces" }, 403);
  }
  try {
    const result = await enrollSample({ tenantId: g.ctx.tenantId, actorId: g.ctx.userId, ...parsed.data });
    return json({ ok: true, ...result });
  } catch (e: any) {
    const code = e?.code === "QUALITY_REJECTED" ? 422 : 400;
    return json({ error: e.message ?? "Enrolment failed" }, code);
  }
}
