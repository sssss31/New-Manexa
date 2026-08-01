import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { randomBytes } from "crypto";

export const COOKIE = "manexa_session";
const DAY = 24 * 60 * 60 * 1000;

export type Role =
  | "SUPER_ADMIN"
  | "INSTITUTION_ADMIN"
  | "PRINCIPAL"
  | "TEACHER"
  | "ACCOUNTANT"
  | "PARENT"
  | "STUDENT"
  | "LIBRARIAN"
  | "TRANSPORT_MGR"
  | "HR";

export async function hashPassword(pw: string) {
  // Cost 12 = current OWASP baseline. Old cost-10 hashes keep verifying
  // (bcrypt embeds the cost in the hash) and upgrade on next password change.
  return bcrypt.hash(pw, 12);
}

/**
 * Strong random password for server-provisioned accounts (admissions, admin
 * user-create). In demo mode this returns the well-known demo password so
 * seeded/demo flows keep working; in production every provisioned account
 * gets an unguessable secret (the admin shares/reset it out-of-band).
 */
export function provisionedPassword(): string {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return "password123";
  return randomBytes(18).toString("base64url"); // ~24 chars, 144 bits
}

// Password policy — enforced on all NEW accounts created through the UI.
// (Seeded demo accounts are exempt by design.)
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must include a digit";
  return null;
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * DAY);
  await prisma.session.create({ data: { userId, token, expiresAt } });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // HTTPS-only in production so the 14-day token never crosses plain HTTP.
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { tenant: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Lazy cleanup: purge the dead row so stale tokens can't linger in the DB.
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: Role | Role[]) {
  const user = await requireUser();
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.includes(user.role as Role)) {
    redirect("/login?err=forbidden");
  }
  return user;
}

/**
 * Granular authorization: the signed-in user must hold `permission` in the
 * tenant's RBAC matrix (Roles page). Makes revoking a permission actually take
 * effect — the coarse role check alone never consulted the matrix.
 * `allowedRoles` keeps the portal-level role gate (defense in depth).
 */
export async function requirePermission(permission: string, allowedRoles?: Role | Role[]) {
  const { can } = await import("./permissions"); // lazy to avoid import cycles
  const user = await requireUser();
  if (allowedRoles) {
    const list = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!list.includes(user.role as Role)) redirect("/login?err=forbidden");
  }
  if (!(await can(user, permission))) {
    redirect(`${roleHome(user.role)}?err=${encodeURIComponent("You don't have permission for this action")}`);
  }
  return user;
}

export function roleHome(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "INSTITUTION_ADMIN":
    case "PRINCIPAL":
      return "/institution";
    case "TEACHER":
      return "/teacher";
    case "ACCOUNTANT":
      return "/accounts";
    case "PARENT":
      return "/parent";
    case "STUDENT":
      return "/student";
    // Staff roles without a dedicated portal yet — land on notifications
    // (works for any authenticated role). Returning /login here caused an
    // infinite redirect loop for logged-in LIBRARIAN/TRANSPORT_MGR/HR users.
    case "LIBRARIAN":
    case "TRANSPORT_MGR":
    case "HR":
      return "/notifications";
    default:
      return "/notifications";
  }
}
