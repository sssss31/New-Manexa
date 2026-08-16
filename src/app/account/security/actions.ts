"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, destroySession } from "@/lib/auth";
import { revokeSession, revokeOtherSessions, currentSessionToken } from "@/lib/sessions";

/** Revoke a single device session the user owns. */
export async function revokeSessionAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const token = await currentSessionToken();

  // Revoking the current device = signing yourself out here → back to login.
  const isCurrent = formData.get("current") === "1";
  if (sessionId) await revokeSession(user.id, sessionId);
  if (isCurrent) {
    await destroySession();
    redirect("/login?notice=" + encodeURIComponent("You've been signed out of this device."));
  }
  void token;
  revalidatePath("/account/security");
}

/** Sign out of every OTHER device, keeping this one active. */
export async function revokeOthersAction() {
  const user = await requireUser();
  const token = await currentSessionToken();
  await revokeOtherSessions(user.id, token);
  revalidatePath("/account/security");
}
