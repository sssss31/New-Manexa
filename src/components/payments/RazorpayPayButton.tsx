"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Loads Razorpay checkout on demand, creates an order server-side, opens the
// hosted checkout, then verifies the signature server-side. Renders nothing
// unless online payments are enabled (the page passes `enabled`).

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function RazorpayPayButton({
  invoiceId, amountLabel, prefillEmail, prefillContact, className = "btn-primary text-xs",
}: {
  invoiceId: string;
  amountLabel: string;
  prefillEmail?: string;
  prefillContact?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await loadCheckout())) { toast.error("Could not load the payment window"); return; }

      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const order = await res.json();
      if (!res.ok) { toast.error(order.error ?? "Could not start payment"); return; }

      const rzp = new window.Razorpay!({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.institution,
        description: `Invoice ${order.invoiceNumber} · ${order.studentName}`,
        prefill: { email: prefillEmail, contact: prefillContact },
        theme: { color: "#B6FF2A" },
        handler: async (resp: Record<string, string>) => {
          const v = await fetch("/api/payments/razorpay/verify", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              invoiceId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const data = await v.json();
          if (v.ok) { toast.success("Payment successful 🎉"); router.refresh(); }
          else toast.error(data.error ?? "Payment could not be verified");
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch {
      toast.error("Payment failed to start");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={pay} disabled={busy} className={className}>
      {busy ? "Opening…" : `Pay ${amountLabel} online`}
    </button>
  );
}
