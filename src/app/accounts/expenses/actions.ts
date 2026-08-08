"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createExpense, deleteExpense } from "@/lib/finance";
import { isNextControlFlowError } from "@/lib/logger";

export async function createExpenseAction(formData: FormData) {
  const user = await requireRole("ACCOUNTANT");
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, ""));
  const spentAtStr = String(formData.get("spentAt") ?? "");
  try {
    await createExpense(user.tenantId!, user.id, {
      category: String(formData.get("category") ?? "OTHER"),
      description: String(formData.get("description") ?? ""),
      amount,
      paidVia: String(formData.get("paidVia") ?? "CASH"),
      vendor: String(formData.get("vendor") ?? ""),
      spentAt: spentAtStr ? new Date(spentAtStr) : null,
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/accounts/expenses?err=" + encodeURIComponent((e as Error).message || "Could not add expense"));
  }
  revalidatePath("/accounts/expenses");
  redirect("/accounts/expenses?notice=" + encodeURIComponent("Expense recorded"));
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireRole("ACCOUNTANT");
  const id = String(formData.get("id") ?? "");
  if (id) await deleteExpense(user.tenantId!, user.id, id);
  revalidatePath("/accounts/expenses");
}
