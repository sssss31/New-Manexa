// Create a Razorpay order for an invoice. Tenant + ownership guarded; a parent
// may only pay their own child's invoices.
import { getCurrentUser, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRazorpayOrder, razorpayEnabled, razorpayKeyId } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["PARENT", "INSTITUTION_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(user.role as Role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!razorpayEnabled()) return Response.json({ error: "Online payments are not enabled" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const invoiceId = String(body?.invoiceId ?? "");
  if (!invoiceId) return Response.json({ error: "Missing invoiceId" }, { status: 400 });

  // Tenant scope + (for parents) child-ownership.
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId,
      ...(user.role === "PARENT"
        ? { student: { parents: { some: { parent: { userId: user.id } } } } }
        : {}),
    },
    include: { tenant: { select: { name: true } }, student: { include: { user: true } } },
  });
  if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "PAID") return Response.json({ error: "This invoice is already paid" }, { status: 409 });

  try {
    const order = await createRazorpayOrder(invoice.total * 100, invoice.number, {
      invoiceId: invoice.id,
      tenantId: user.tenantId,
    });
    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId(),
      institution: invoice.tenant.name,
      invoiceNumber: invoice.number,
      studentName: invoice.student.user.displayName,
    });
  } catch {
    return Response.json({ error: "Could not start the payment — please try again" }, { status: 502 });
  }
}
