"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { payInvoice } from "@/lib/engine";

export async function payInvoiceAsParent(formData: FormData) {
  const user = await requireRole("PARENT");
  const invoiceId = String(formData.get("invoiceId"));
  const method = String(formData.get("method") || "UPI") as any;
  // Verify parent owns this invoice
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId!,
      student: { parents: { some: { parent: { userId: user.id } } } },
    },
  });
  if (!invoice) return;
  // Optional partial amount from the parent (blank = pay full outstanding).
  const raw = String(formData.get("amount") ?? "").trim();
  const amount = raw ? Math.round(Number(raw)) : undefined;
  if (raw && (!Number.isFinite(amount!) || amount! <= 0)) throw new Error("Enter a valid amount");
  await payInvoice({
    tenantId: user.tenantId!,
    invoiceId,
    method,
    amount,
    actorId: user.id,
  });
  revalidatePath("/parent");
  revalidatePath("/parent/fees");
  revalidatePath("/accounts");
  revalidatePath("/accounts/collections");
}
