"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createDocument, deleteDocument } from "@/lib/ops";
import { isNextControlFlowError } from "@/lib/logger";

const ROLES = ["INSTITUTION_ADMIN", "PRINCIPAL"] as const;

export async function createDocumentAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  try {
    await createDocument(user.tenantId!, user.id, {
      title: String(formData.get("title") ?? ""),
      category: String(formData.get("category") ?? "GENERAL"),
      ownerType: String(formData.get("ownerType") ?? "INSTITUTION"),
      reference: String(formData.get("reference") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/institution/documents?err=" + encodeURIComponent((e as Error).message || "Could not add document"));
  }
  revalidatePath("/institution/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  await deleteDocument(user.tenantId!, user.id, String(formData.get("id") ?? ""));
  revalidatePath("/institution/documents");
}
