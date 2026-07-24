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
  return bcrypt.hash(pw, 10);
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
  if (!session || session.expiresAt < new Date()) return null;
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
    default:
      return "/login";
  }
}
