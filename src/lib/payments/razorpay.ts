// Razorpay online-payment integration. No SDK dependency — the Orders API is
// a simple authenticated REST call and signature verification is HMAC-SHA256.
// Activates only when RAZORPAY keys are configured; otherwise the app keeps
// using the existing (simulated) offline payment flow — nothing breaks.

import { createHmac, timingSafeEqual } from "crypto";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function razorpayEnabled(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}
export function razorpayKeyId(): string | null {
  return KEY_ID ?? null;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Create a Razorpay order for `amountPaise` (INR paise). Server-side only. */
export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
  notes?: Record<string, string>
): Promise<RazorpayOrder> {
  if (!razorpayEnabled()) throw new Error("Razorpay is not configured");
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: receipt.slice(0, 40),
      notes,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay order failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Fetch an order from Razorpay to confirm amount / status / notes server-side
 *  (never trust the client's claimed invoice or amount). */
export async function fetchRazorpayOrder(orderId: string): Promise<{
  id: string; amount: number; status: string; notes?: Record<string, string>;
}> {
  if (!razorpayEnabled()) throw new Error("Razorpay is not configured");
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Razorpay order fetch failed (${res.status})`);
  return (await res.json()) as { id: string; amount: number; status: string; notes?: Record<string, string> };
}

/**
 * Verify the checkout callback signature. Razorpay signs `${orderId}|${paymentId}`
 * with the key secret (HMAC-SHA256, hex). Constant-time compare.
 */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
