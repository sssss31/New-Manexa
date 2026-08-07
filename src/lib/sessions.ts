// Session & device management — the domain logic behind the "Active sessions"
// security screen. Every function is scoped to a single userId so a signed-in
// user can only ever see or revoke their OWN sessions (never another user's).
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { COOKIE } from "./auth";

export type DeviceInfo = { browser: string; os: string; kind: "Mobile" | "Tablet" | "Desktop" };

/** Best-effort, dependency-free User-Agent parse for a friendly device label. */
export function parseUserAgent(ua?: string | null): DeviceInfo {
  const s = ua ?? "";
  const kind: DeviceInfo["kind"] = /iPad|Tablet/i.test(s)
    ? "Tablet"
    : /Mobi|Android|iPhone|iPod/i.test(s)
      ? "Mobile"
      : "Desktop";

  const os = /Windows NT 10/i.test(s)
    ? "Windows"
    : /Windows/i.test(s)
      ? "Windows"
      : /iPhone|iPad|iPod/i.test(s)
        ? "iOS"
        : /Mac OS X|Macintosh/i.test(s)
          ? "macOS"
          : /Android/i.test(s)
            ? "Android"
            : /Linux/i.test(s)
              ? "Linux"
              : "Unknown OS";

  // Order matters: Edge/Chrome UAs also contain "Safari"; check the specific
  // brands first so the label isn't wrongly reported as Safari/Chrome.
  const browser = /Edg\//i.test(s)
    ? "Edge"
    : /OPR\/|Opera/i.test(s)
      ? "Opera"
      : /Firefox\//i.test(s)
        ? "Firefox"
        : /Chrome\//i.test(s)
          ? "Chrome"
          : /Safari\//i.test(s)
            ? "Safari"
            : "Browser";

  return { browser, os, kind };
}

/** The token of the request's own session (so the UI can flag "This device"). */
export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export type SessionRow = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  ip: string | null;
  device: DeviceInfo;
  current: boolean;
};

/** All live (non-expired) sessions for a user, current device first. */
export async function listSessions(userId: string, currentToken?: string | null): Promise<SessionRow[]> {
  const rows = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, token: true, createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true },
  });
  return rows
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
      expiresAt: r.expiresAt,
      ip: r.ip,
      device: parseUserAgent(r.userAgent),
      current: !!currentToken && r.token === currentToken,
    }))
    .sort((a, b) => (a.current === b.current ? 0 : a.current ? -1 : 1));
}

/**
 * Revoke one session by id. Scoped to `userId`, so it can only ever delete a
 * session the caller owns. Returns whether a row was actually removed.
 */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const res = await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  if (res.count > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    await audit({
      tenantId: user?.tenantId ?? null,
      actorId: userId,
      action: "SESSION_REVOKED",
      entity: "Session",
      entityId: sessionId,
      detail: "User revoked a device session",
    });
  }
  return res.count > 0;
}

/**
 * Log out everywhere except the current device. Deletes every other live
 * session for the user. Returns how many were signed out.
 */
export async function revokeOtherSessions(userId: string, keepToken: string | null): Promise<number> {
  const res = await prisma.session.deleteMany({
    where: { userId, ...(keepToken ? { token: { not: keepToken } } : {}) },
  });
  if (res.count > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    await audit({
      tenantId: user?.tenantId ?? null,
      actorId: userId,
      action: "SESSIONS_REVOKED_OTHERS",
      entity: "Session",
      detail: `Signed out ${res.count} other device${res.count === 1 ? "" : "s"}`,
    });
  }
  return res.count;
}
