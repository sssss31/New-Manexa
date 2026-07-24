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
  await payInvoice({
    tenantId: user.tenantId!,
    invoiceId,
    method,
    actorId: user.id,
  });
  revalidatePath("/parent");
  revalidatePath("/parent/fees");
}
