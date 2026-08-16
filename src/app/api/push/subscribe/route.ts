// Store / remove a browser's Web Push subscription for the signed-in user.
// POST   { subscription }  → upsert (keyed on endpoint)
// DELETE { endpoint }      → remove this device's subscription

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: user.id, tenantId: user.tenantId ?? null, p256dh: sub.keys.p256dh, auth: sub.keys.auth, ua },
    create: {
      userId: user.id,
      tenantId: user.tenantId ?? null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      ua,
    },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  }
  return Response.json({ ok: true });
}
