"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { issueOtp, verifyOtp, DEV_OTP_COOKIE } from "@/lib/otp";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { isNextControlFlowError } from "@/lib/logger";

export async function sendVerifyCodeAction() {
  const user = await requireUser();
  if (user.emailVerifiedAt) {
    redirect("/account/security?notice=" + encodeURIComponent("Your email is already verified."));
  }
  try {
    const res = await issueOtp({ purpose: "EMAIL_VERIFY", email: user.email, userId: user.id });
    if (!res.ok) {
      const msg =
        res.error === "rate_limited"
          ? "Too many requests — please wait a few minutes and try again."
          : "Couldn't send the code right now — please try again.";
      redirect("/verify-email?err=" + encodeURIComponent(msg));
    }
    if (res.devCode) {
      const store = await cookies();
      store.set(DEV_OTP_COOKIE, res.devCode, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/verify-email" });
    }
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/verify-email?err=" + encodeURIComponent("Couldn't send the code right now — please try again."));
  }
  redirect("/verify-email?sent=1");
}

export async function verifyCodeAction(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  try {
    const res = await verifyOtp({ purpose: "EMAIL_VERIFY", email: user.email, code });
    if (!res.ok) {
      const map: Record<string, string> = {
        invalid: "That code is incorrect. Please try again.",
        too_many_attempts: "Too many attempts — request a fresh code.",
        expired_or_missing: "That code has expired — request a new one.",
      };
      redirect("/verify-email?sent=1&err=" + encodeURIComponent(map[res.error]));
    }
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    const store = await cookies();
    store.delete(DEV_OTP_COOKIE);
    after(() => {
      audit({ tenantId: user.tenantId, actorId: user.id, action: "EMAIL_VERIFIED", entity: "User", entityId: user.id, detail: user.email });
      if (user.tenantId) {
        notify({
          tenantId: user.tenantId,
          userId: user.id,
          kind: "system",
          title: "Email verified",
          body: "Your email address has been verified.",
          href: "/account/security",
        });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/verify-email?sent=1&err=" + encodeURIComponent("Something went wrong — please try again."));
  }
  redirect("/account/security?notice=" + encodeURIComponent("Email verified ✓"));
}
