"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createInvoice, payInvoice, runPayroll, approvePayroll, disbursePayroll } from "@/lib/engine";

async function actor() {
  return requireRole(["ACCOUNTANT", "INSTITUTION_ADMIN"]);
}

export async function generateMonthlyInvoicesAction() {
  const a = await actor();
  const students = await prisma.student.findMany({
    where: { tenantId: a.tenantId!, status: "ACTIVE" },
  });
  const label = new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
  const structures = await prisma.feeStructure.findMany({ where: { tenantId: a.tenantId! } });
  const byClass = new Map(structures.map((s) => [s.classId, s]));
  let count = 0;
  for (const s of students) {
    const st = byClass.get(s.classId);
    if (!st) continue;
    const already = await prisma.invoice.findFirst({
      where: { studentId: s.id, periodLabel: label },
    });
    if (already) continue;
    await createInvoice({
      tenantId: a.tenantId!,
      studentId: s.id,
      periodLabel: label,
      structureId: st.id,
      actorId: a.id,
      dueInDays: 15,
    });
    count++;
  }
  revalidatePath("/accounts/invoices");
  revalidatePath("/accounts");
}

export async function payInvoiceAction(formData: FormData) {
  const a = await actor();
  await payInvoice({
    tenantId: a.tenantId!,
    invoiceId: String(formData.get("invoiceId")),
    method: String(formData.get("method") || "CASH") as any,
    actorId: a.id,
  });
  revalidatePath("/accounts/invoices");
  revalidatePath("/accounts");
  revalidatePath("/parent");
}

export async function runPayrollAction(formData: FormData) {
  const a = await actor();
  await runPayroll({ tenantId: a.tenantId!, actorId: a.id, period: String(formData.get("period")) });
  revalidatePath("/accounts/payroll");
}
export async function approvePayrollAction(formData: FormData) {
  const a = await actor();
  await approvePayroll({ tenantId: a.tenantId!, actorId: a.id, runId: String(formData.get("runId")) });
  revalidatePath("/accounts/payroll");
}
export async function disbursePayrollAction(formData: FormData) {
  const a = await actor();
  await disbursePayroll({ tenantId: a.tenantId!, actorId: a.id, runId: String(formData.get("runId")) });
  revalidatePath("/accounts/payroll");
}
