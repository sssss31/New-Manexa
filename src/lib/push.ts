// Web Push sender — signs and delivers notifications to a user's subscribed
// devices via VAPID. Best-effort: never throws (a failed push must not break
// the in-app notification), and prunes subscriptions the push service reports
// as expired (404/410 Gone). No-op when VAPID keys aren't configured.

import webpush from "web-push";
import { prisma } from "./prisma";
import { logger } from "./logger";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@manexa.test";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
};

/**
 * Deliver a push to every subscription belonging to the given users.
 * Returns counts; swallows all errors. Safe to call from any mutation path.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  if (!ensureConfigured() || userIds.length === 0) return { sent: 0, pruned: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href ?? undefined,
    tag: payload.tag,
  });

  const dead: string[] = [];
  let sent = 0;

  // Bounded concurrency: batches of 25 (an unbounded Promise.all across a
  // whole school's subscriptions would open hundreds of simultaneous TLS
  // connections to the push services).
  const BATCH = 25;
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) dead.push(s.id);
          else logger.warn("push send failed", { code, endpoint: s.endpoint.slice(0, 48) });
        }
      })
    );
  }

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }
  return { sent, pruned: dead.length };
}
