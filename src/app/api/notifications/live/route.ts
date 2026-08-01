// Live notification poll — the transport for the app-wide real-time layer.
//
// Authenticated via the existing DB session (no browser anon key, no RLS
// dependency), so it is safe on Vercel serverless today. This is the seam:
// swapping to Supabase Realtime later means replacing the client poller, not
// this contract.
//
// Cursor semantics: the `cursor` returned to the client is ALWAYS derived from
// DB row timestamps (max createdAt of delivered rows), never from the Node
// process clock — server/DB clock skew or the gap between query and response
// used to permanently drop notifications created in that window.

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationWhere } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const hasSince = since !== null && !Number.isNaN(since.getTime());

  const where = notificationWhere(user);
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  if (!hasSince) {
    // First poll of a session: hand out a DB-derived starting cursor and no
    // items (nothing gets replayed on page load). Falls back to DB now() when
    // the user has no notifications yet.
    const latest = await prisma.notification.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const cursor =
      latest?.createdAt ??
      (await prisma.$queryRaw<{ now: Date }[]>`SELECT now() as now`)[0]?.now ??
      new Date();
    return Response.json(
      { unread, cursor: cursor.toISOString(), items: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const fresh = await prisma.notification.findMany({
    where: { ...where, createdAt: { gt: since! } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, kind: true, title: true, body: true,
      href: true, createdAt: true, userId: true,
    },
  });

  // Advance the cursor only as far as rows we actually delivered.
  const cursor = fresh.length ? fresh[0].createdAt : since!;

  return Response.json(
    {
      unread,
      cursor: cursor.toISOString(),
      items: fresh.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
        createdAt: n.createdAt.toISOString(),
        targeted: n.userId === user.id,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
