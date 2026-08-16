"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { logger, isNextControlFlowError } from "@/lib/logger";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  try {
    // Rate-limit by email to blunt enumeration + abuse.
    await checkRateLimit(`reset:${email}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.windowMs, { durable: true });

    // Capture origin now (headers() can't be read inside after()).
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host") ?? "app.manexa.com"}`;

    // Do the lookup + token work AFTER the response so timing never reveals
    // whether the account exists (constant-time from the user's perspective).
    after(async () => {
      try {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) return; // silently no-op for unknown emails
        const token = randomBytes(32).toString("hex");
        await prisma.passwordResetToken.create({
          data: { token, userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
        });
        const link = `${origin}/reset?token=${token}`;
        // Simulated email delivery (like the app's other external services).
        logger.info("password reset requested", { email, link });
        await audit({ actorId: user.id, action: "PASSWORD_RESET_REQUEST", entity: "User", entityId: user.id });
      } catch (e) {
        logger.error("reset token creation failed", e, { email });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    logger.error("requestReset failed", e, { email });
  }

  // ALWAYS the same outcome — never disclose whether the account exists.
  redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);
}
