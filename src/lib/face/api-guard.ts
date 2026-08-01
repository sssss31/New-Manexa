// Shared guard for the /api/face/* REST surface: session auth, role check,
// tenant resolution, and rate limiting. Returns a typed context or a Response
// to short-circuit.

import { getCurrentUser, type Role } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export interface FaceCtx {
  userId: string;
  tenantId: string;
  role: string;
}

export async function guard(
  req: Request,
  opts: { roles: Role[]; limit?: number; windowMs?: number; bucket: string }
): Promise<{ ctx: FaceCtx } | { res: Response }> {
  const user = await getCurrentUser();
  if (!user) return { res: json({ error: "Unauthorized" }, 401) };
  if (!opts.roles.includes(user.role as Role)) return { res: json({ error: "Forbidden" }, 403) };
  if (!user.tenantId) return { res: json({ error: "No tenant" }, 403) };

  const key = `face:${opts.bucket}:${user.id}`;
  if (!(await checkRateLimit(key, opts.limit ?? 120, opts.windowMs ?? 60_000))) {
    return { res: json({ error: "Rate limit exceeded" }, 429) };
  }
  return { ctx: { userId: user.id, tenantId: user.tenantId, role: user.role } };
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
