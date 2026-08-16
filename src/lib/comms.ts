// Outbound email + SMS. Real delivery when a provider is configured (Resend for
// email, MSG91 for SMS — both over plain fetch, no extra deps); otherwise the
// message is logged server-side so every flow stays fully functional in dev.
// Mirrors the app's other external integrations (Razorpay, VAPID): real when
// keys are present, gracefully simulated when they're not.
import { logger } from "./logger";
import { BRAND_DARK } from "./design-system";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}
export function smsEnabled(): boolean {
  return !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID);
}

export type SendResult = { ok: boolean; simulated: boolean; error?: string };

const DEFAULT_FROM = "MANEXA <onboarding@resend.dev>";

/**
 * Send a transactional email via Resend. Falls back to a server-side log when
 * RESEND_API_KEY is absent (dev/simulated) — never throws to the caller.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  if (!emailEnabled()) {
    logger.info("email (simulated — set RESEND_API_KEY to send for real)", {
      to: args.to,
      subject: args.subject,
    });
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text ?? stripHtml(args.html),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error("email send failed", new Error(`Resend ${res.status}`), { to: args.to, detail: detail.slice(0, 300) });
      return { ok: false, simulated: false, error: `email provider returned ${res.status}` };
    }
    return { ok: true, simulated: false };
  } catch (e) {
    logger.error("email send threw", e, { to: args.to });
    return { ok: false, simulated: false, error: "email delivery failed" };
  }
}

/**
 * Send an SMS via MSG91. Falls back to a server-side log when unconfigured.
 * `text` is the fully-rendered message (India numbers may need DLT templates —
 * this uses MSG91's flow/sendhttp for the MVP).
 */
export async function sendSms(args: { to: string; text: string }): Promise<SendResult> {
  const to = normalizePhone(args.to);
  if (!smsEnabled()) {
    logger.info("sms (simulated — set MSG91_AUTH_KEY to send for real)", { to, text: args.text });
    return { ok: true, simulated: true };
  }
  try {
    const url = new URL("https://api.msg91.com/api/sendhttp.php");
    url.searchParams.set("authkey", process.env.MSG91_AUTH_KEY!);
    url.searchParams.set("mobiles", to);
    url.searchParams.set("message", args.text);
    url.searchParams.set("sender", process.env.MSG91_SENDER_ID!);
    url.searchParams.set("route", "4"); // transactional
    url.searchParams.set("country", "91");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      logger.error("sms send failed", new Error(`MSG91 ${res.status}`), { to });
      return { ok: false, simulated: false, error: `sms provider returned ${res.status}` };
    }
    return { ok: true, simulated: false };
  } catch (e) {
    logger.error("sms send threw", e, { to });
    return { ok: false, simulated: false, error: "sms delivery failed" };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^0+/, "");
}

// ---- Branded email template ------------------------------------------------

/**
 * A minimal, email-client-safe MANEXA shell around a body + big code/CTA.
 *
 * Email clients strip <style> blocks and do not resolve CSS variables, so every
 * colour has to be an inline literal. They come from `BRAND_DARK` so the mail
 * stays on the same neon-on-black palette as the app instead of drifting.
 */
export function otpEmailHtml(opts: { code: string; purpose: string; minutes: number }): string {
  const c = BRAND_DARK;
  const title = opts.purpose === "PHONE_VERIFY" ? "Verify your phone" : "Verify your email";
  return `<!doctype html><html><body style="margin:0;background:${c.bg};padding:32px 0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="border:1px solid ${c.border};border-radius:16px;overflow:hidden;background-color:${c.card}">
      <tr><td style="padding:28px 32px 8px 32px">
        <div style="font-size:20px;font-weight:700;color:${c.fg};letter-spacing:-0.5px">MANEXA</div>
        <div style="font-size:12px;color:${c.subtle};margin-top:2px">AI-Powered Education OS</div>
      </td></tr>
      <tr><td style="padding:12px 32px 0 32px">
        <h1 style="font-size:20px;color:${c.fg};margin:12px 0 6px 0">${title}</h1>
        <p style="font-size:14px;color:${c.muted};line-height:1.5;margin:0 0 20px 0">Enter this code to confirm it's you. It expires in ${opts.minutes} minutes.</p>
        <div style="text-align:center;margin:8px 0 20px 0">
          <span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:700;color:${c.accent};background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:16px 22px">${opts.code}</span>
        </div>
        <p style="font-size:12px;color:${c.subtle};line-height:1.5;margin:0 0 8px 0">If you didn't request this, you can safely ignore this email — no changes will be made to your account.</p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px 32px;border-top:1px solid ${c.border};margin-top:16px">
        <div style="font-size:11px;color:${c.subtle}">© MANEXA · This is an automated message, please don't reply.</div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
