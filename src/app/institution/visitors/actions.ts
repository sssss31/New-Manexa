"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { checkInVisitor, checkOutVisitor } from "@/lib/ops";
import { isNextControlFlowError } from "@/lib/logger";

const ROLES = ["INSTITUTION_ADMIN", "PRINCIPAL"] as const;

export async function checkInAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  try {
    await checkInVisitor(user.tenantId!, user.id, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      host: String(formData.get("host") ?? ""),
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/institution/visitors?err=" + encodeURIComponent((e as Error).message || "Could not check in visitor"));
  }
  revalidatePath("/institution/visitors");
}

export async function checkOutAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  await checkOutVisitor(user.tenantId!, user.id, String(formData.get("id") ?? ""));
  revalidatePath("/institution/visitors");
}
