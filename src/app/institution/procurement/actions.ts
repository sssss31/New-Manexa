"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createVendor, createPurchaseOrder, setPurchaseOrderStatus } from "@/lib/ops";
import { isNextControlFlowError } from "@/lib/logger";

const ROLES = ["INSTITUTION_ADMIN", "PRINCIPAL"] as const;
const back = (err?: string) => redirect(`/institution/procurement${err ? "?err=" + encodeURIComponent(err) : ""}`);

export async function createVendorAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  try {
    await createVendor(user.tenantId!, user.id, {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? "GENERAL"),
      contact: String(formData.get("contact") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      gstin: String(formData.get("gstin") ?? ""),
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    back((e as Error).message || "Could not add vendor");
  }
  revalidatePath("/institution/procurement");
}

export async function createPurchaseOrderAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, ""));
  try {
    await createPurchaseOrder(user.tenantId!, user.id, {
      vendorId: String(formData.get("vendorId") ?? ""),
      description: String(formData.get("description") ?? ""),
      amount,
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    back((e as Error).message || "Could not create purchase order");
  }
  revalidatePath("/institution/procurement");
}

export async function setPoStatusAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  await setPurchaseOrderStatus(user.tenantId!, user.id, String(formData.get("id") ?? ""), String(formData.get("status") ?? ""));
  revalidatePath("/institution/procurement");
}
