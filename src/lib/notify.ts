import { after } from "next/server";
import { prisma } from "./prisma";
import { sendPushToUsers } from "./push";
import { logger } from "./logger";

// In-app notification fan-out. Targeted (userId) or broadcast (role / all).
// Every notification is ALSO delivered as a Web Push to the recipients' devices
// (best-effort — a push failure never affects the stored in-app notification).
export async function notify(args: {
  tenantId: string;
  userId?: string | null;
  role?: string | null;
  kind: string;
  title: string;
  body: string;
  href?: string;
}) {
  await prisma.notification.create({
    data: {
      tenantId: args.tenantId,
      userId: args.userId ?? null,
      role: args.role ?? null,
      kind: args.kind,
      title: args.title,
      body: args.body,
      href: args.href,
    },
  });

  // Fan out to phones AFTER the response is sent (never blocks the mutation —
  // a role-broadcast to hundreds of parents used to run inline and could push
  // the request past the serverless timeout). Isolated so it can never break
  // the stored in-app record either.
  const fanOut = async () => {
    try {
      const userIds = await resolvePushTargets(args);
      if (userIds.length) {
        await sendPushToUsers(userIds, {
          title: args.title,
          body: args.body,
          href: args.href,
          tag: args.kind,
        });
      }
    } catch {
      logger.warn("push fan-out failed", { kind: args.kind, tenantId: args.tenantId });
    }
  };
  try {
    after(fanOut); // runs post-response in route handlers / server actions
  } catch {
    void fanOut(); // outside a request scope (seed scripts, tests) — fire directly
  }
}

// Resolve the concrete user ids a notification should push to:
//  - targeted   → that one user
//  - role cast  → all ACTIVE users of that role in the tenant
//  - tenant cast → all ACTIVE users in the tenant (capped, best-effort)
async function resolvePushTargets(args: {
  tenantId: string;
  userId?: string | null;
  role?: string | null;
}): Promise<string[]> {
  if (args.userId) return [args.userId];
  const CAP = 2000;
  const users = await prisma.user.findMany({
    where: {
      tenantId: args.tenantId,
      status: "ACTIVE",
      ...(args.role ? { role: args.role } : {}),
    },
    select: { id: true },
    take: CAP,
  });
  if (users.length === CAP) {
    // Never truncate silently — log so an over-cap tenant is visible in ops.
    logger.warn("push broadcast hit target cap", { tenantId: args.tenantId, cap: CAP });
  }
  return users.map((u) => u.id);
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
