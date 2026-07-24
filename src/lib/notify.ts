import { prisma } from "./prisma";

// In-app notification fan-out. Targeted (userId) or broadcast (role / all).
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
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
