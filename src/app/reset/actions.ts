"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { logger, isNextControlFlowError } from "@/lib/logger";

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (msg: string) => redirect(`/reset?token=${encodeURIComponent(token)}&err=${encodeURIComponent(msg)}`);

  if (!token) redirect("/forgot?err=invalid");
  if (password !== confirm) back("Passwords do not match");
  const pwErr = validatePassword(password);
  if (pwErr) back(pwErr);

  try {
    const row = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: true } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      redirect("/forgot?err=expired");
    }
    const hash = await hashPassword(password);
    // Atomic: set the new password, consume the token, and revoke every
    // existing session so a leaked old session can't survive a reset.
    await prisma.$transaction([
      prisma.user.update({ where: { id: row!.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.update({ where: { id: row!.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: row!.userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: row!.userId, usedAt: null } }),
    ]);
    await audit({ tenantId: row!.user.tenantId, actorId: row!.userId, action: "PASSWORD_RESET", entity: "User", entityId: row!.userId });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    logger.error("resetPassword failed", e);
    back("Could not reset your password — please request a new link.");
  }

  redirect(`/login?notice=${encodeURIComponent("Password updated — please sign in.")}`);
}
