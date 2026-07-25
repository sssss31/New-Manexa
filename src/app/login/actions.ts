"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, roleHome, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { logger, isNextControlFlowError, isDbConnectionError } from "@/lib/logger";

async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
  };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    // Brute-force protection: 5 attempts / 5 minutes per account.
    if (!rateLimit(`login:${email}`, 5, 5 * 60_000)) {
      await audit({ action: "LOGIN_LOCKED", entity: "User", detail: email });
      redirect("/login?err=locked");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await audit({ action: "LOGIN_FAILED", entity: "User", detail: email });
      redirect("/login?err=invalid");
    }
    // Pending joins can't sign in until an institution admin approves them.
    if (user.status === "PENDING") redirect("/login?err=pending");
    if (user.status !== "ACTIVE") redirect("/login?err=invalid");

    const ok = await verifyPassword(password, user.passwordHash);
    const meta = await clientMeta();
    if (!ok) {
      await prisma.loginEvent.create({ data: { userId: user.id, tenantId: user.tenantId, ...meta, outcome: "FAILED" } });
      await audit({ tenantId: user.tenantId, action: "LOGIN_FAILED", entity: "User", entityId: user.id, detail: email });
      redirect("/login?err=invalid");
    }
    await prisma.loginEvent.create({ data: { userId: user.id, tenantId: user.tenantId, ...meta, outcome: "SUCCESS" } });
    await createSession(user.id);
    redirect(roleHome(user.role));
  } catch (e) {
    // redirect()/notFound() throw control-flow errors — let them through.
    if (isNextControlFlowError(e)) throw e;
    // Real failure (most often the DB being unreachable from the serverless
    // runtime). Log the root cause to server logs; show the user a safe message.
    const dbDown = isDbConnectionError(e);
    logger.error(dbDown ? "login failed: database unreachable" : "login failed: unexpected error", e, {
      route: "loginAction",
      email,
    });
    redirect(`/login?err=${dbDown ? "dbdown" : "server"}`);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
