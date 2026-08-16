// Verify a Razorpay checkout callback and record the payment. Security:
//  1. HMAC signature must be valid (only Razorpay could produce it).
//  2. The order is re-fetched from Razorpay and its notes.invoiceId + amount +
//     paid status are confirmed server-side — the client's claimed invoice and
//     amount are never trusted (blocks paying a cheap order to clear a big one).
import { getCurrentUser, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payInvoice } from "@/lib/engine";
import { verifyRazorpaySignature, fetchRazorpayOrder, razorpayEnabled } from "@/lib/payments/razorpay";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["PARENT", "INSTITUTION_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(user.role as Role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!razorpayEnabled()) return Response.json({ error: "Online payments are not enabled" }, { status: 503 });

  const b = await req.json().catch(() => null);
  const invoiceId = String(b?.invoiceId ?? "");
  const orderId = String(b?.razorpay_order_id ?? "");
  const paymentId = String(b?.razorpay_payment_id ?? "");
  const signature = String(b?.razorpay_signature ?? "");
  if (!invoiceId || !orderId || !paymentId || !signature) {
    return Response.json({ error: "Missing payment fields" }, { status: 400 });
  }

  // 1. Cryptographic signature check.
  if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
    return Response.json({ error: "Payment signature verification failed" }, { status: 400 });
  }

  // Ownership-scoped invoice.
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId,
      ...(user.role === "PARENT" ? { student: { parents: { some: { parent: { userId: user.id } } } } } : {}),
    },
    include: { payments: { select: { amount: true } } },
  });
  if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });

  // Outstanding is the authoritative charge amount — the client-sent amount is
  // never trusted; it must match what the gateway actually captured.
  const outstanding = invoice.total - invoice.payments.reduce((s, p) => s + p.amount, 0);

  // 2. Confirm the order against Razorpay: right invoice, right amount, paid.
  try {
    const order = await fetchRazorpayOrder(orderId);
    if (order.notes?.invoiceId !== invoice.id || order.amount !== outstanding * 100) {
      return Response.json({ error: "Payment does not match this invoice" }, { status: 400 });
    }
    if (order.status !== "paid") {
      return Response.json({ error: "Payment not captured yet" }, { status: 409 });
    }
  } catch {
    return Response.json({ error: "Could not confirm the payment — please contact the institution" }, { status: 502 });
  }

  try {
    await payInvoice({
      tenantId: user.tenantId,
      invoiceId: invoice.id,
      method: "RAZORPAY",
      amount: outstanding,
      actorId: user.id,
      gatewayTxId: paymentId,
    });
  } catch (e) {
    // Already-paid (race / double callback) is not an error to the payer.
    if ((e as Error).message?.includes("paid")) return Response.json({ ok: true, alreadyPaid: true });
    return Response.json({ error: "Recorded payment but failed to update the invoice — contact the institution" }, { status: 500 });
  }

  return Response.json({ ok: true, invoiceId: invoice.id });
}
