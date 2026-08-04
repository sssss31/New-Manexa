"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, roleHome, verifyPassword } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
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
    // Round-trip 1: the rate-limit gate and the user lookup are independent, so
    // fire them concurrently — one round-trip of wall time instead of two.
    // (Brute-force protection: 5 attempts / 5 minutes per account.)
    const [allowed, user] = await Promise.all([
      checkRateLimit(`login:${email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs, { durable: true }),
      prisma.user.findUnique({ where: { email } }),
    ]);

    if (!allowed) {
      after(() => audit({ action: "LOGIN_LOCKED", entity: "User", detail: email }));
      redirect("/login?err=locked");
    }
    if (!user) {
      after(() => audit({ action: "LOGIN_FAILED", entity: "User", detail: email }));
      redirect("/login?err=invalid");
    }
    // Pending joins can't sign in until an institution admin approves them.
    if (user.status === "PENDING") redirect("/login?err=pending");
    if (user.status !== "ACTIVE") redirect("/login?err=invalid");

    // Password verify (CPU) — capture request headers now (headers() can't be
    // read inside after()).
    const ok = await verifyPassword(password, user.passwordHash);
    const meta = await clientMeta();
    if (!ok) {
      after(() => {
        prisma.loginEvent.create({ data: { userId: user.id, tenantId: user.tenantId, ...meta, outcome: "FAILED" } }).catch(() => {});
        audit({ tenantId: user.tenantId, action: "LOGIN_FAILED", entity: "User", entityId: user.id, detail: email });
      });
      redirect("/login?err=invalid");
    }
    // Round-trip 2: create the session (the cookie needs its token — sync).
    // "Remember me" (checkbox → "on") controls cookie persistence.
    await createSession(user.id, { remember: formData.get("remember") === "on" });
    // Analytics write is deferred so it never blocks the redirect.
    after(() => {
      prisma.loginEvent.create({ data: { userId: user.id, tenantId: user.tenantId, ...meta, outcome: "SUCCESS" } }).catch(() => {});
    });
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
