// Canonical notification visibility — one source of truth so the bell badge,
// the /notifications list, and the live poller never disagree.
//
// A user sees: (a) notifications targeted personally (userId = them),
// (b) broadcasts to their role, (c) tenant-wide broadcasts (role = null).
// Everything is tenant-scoped.

import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export function notificationWhere(user: {
  id: string;
  role: string;
  tenantId: string | null;
}): Prisma.NotificationWhereInput {
  // Tenant-less users (platform SUPER_ADMIN) see ONLY personally-targeted
  // notifications. `tenantId: undefined` would drop the filter entirely and
  // leak every tenant's broadcasts to them.
  if (!user.tenantId) return { userId: user.id };
  return {
    tenantId: user.tenantId,
    OR: [
      { userId: user.id },
      { userId: null, role: user.role },
      { userId: null, role: null },
    ],
  };
}

// Badge count = personally-targeted AND unread. Role/tenant broadcasts share a
// single `readAt` column (no per-user read state), so they never inflate the
// badge — they surface as live toasts instead.
export function unreadCount(user: { id: string }) {
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}
