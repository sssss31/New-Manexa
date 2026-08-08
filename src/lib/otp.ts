// One-time code engine for email/phone verification (and OTP sign-in later).
// Codes are 6 digits, valid 10 minutes, single-use, capped at 5 attempts, and
// rate-limited per target. Only an HMAC of the code is ever stored, so a DB
// leak never exposes usable codes. Real delivery via comms.ts (email/SMS);
// in dev (no provider) the code is logged AND returned so flows are testable.
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { env } from "./env";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";
import { sendEmail, sendSms, otpEmailHtml } from "./comms";
import { logger } from "./logger";

export type OtpPurpose = "EMAIL_VERIFY" | "PHONE_VERIFY" | "LOGIN_2FA";

// Dev-only cookie: when no email provider is configured, the simulated code is
// stashed here (short-lived, path-scoped) so the verify page can surface it.
// Never set when a real email was actually sent.
export const DEV_OTP_COOKIE = "mnx_dev_otp";

const CODE_LEN = 6;
const TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

function pepper(): string {
  return process.env.OTP_SECRET || env.SESSION_SECRET;
}
function hashCode(purpose: string, target: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${purpose}:${target.toLowerCase()}:${code}`).digest("hex");
}
function generateCode(): string {
  // crypto-strong, zero-padded, no leading-zero bias.
  return String(randomInt(0, 10 ** CODE_LEN)).padStart(CODE_LEN, "0");
}
function constantEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

type Target = { channel: "EMAIL" | "SMS"; value: string };
function resolveTarget(a: { purpose: OtpPurpose; email?: string | null; phone?: string | null }): Target | null {
  if (a.purpose === "PHONE_VERIFY") return a.phone ? { channel: "SMS", value: a.phone } : null;
  if (a.email) return { channel: "EMAIL", value: a.email };
  if (a.phone) return { channel: "SMS", value: a.phone };
  return null;
}

export type IssueResult =
  | { ok: true; channel: "EMAIL" | "SMS"; simulated: boolean; devCode?: string; expiresInMin: number }
  | { ok: false; error: "no_target" | "rate_limited" | "send_failed" };

/**
 * Issue a fresh code for `purpose`+target, invalidating any prior unconsumed
 * codes for the same target, and deliver it. Rate-limited per target.
 */
export async function issueOtp(args: {
  purpose: OtpPurpose;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}): Promise<IssueResult> {
  const t = resolveTarget(args);
  if (!t) return { ok: false, error: "no_target" };
  const key = t.value.toLowerCase();

  const allowed = await checkRateLimit(`otp:${args.purpose}:${key}`, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.windowMs, { durable: true });
  if (!allowed) return { ok: false, error: "rate_limited" };

  const code = generateCode();
  const codeHash = hashCode(args.purpose, key, code);
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);

  // One live code per target: drop previous unconsumed rows before inserting.
  await prisma.otpCode.deleteMany({
    where: {
      purpose: args.purpose,
      consumedAt: null,
      ...(t.channel === "EMAIL" ? { email: key } : { phone: key }),
    },
  });
  await prisma.otpCode.create({
    data: {
      purpose: args.purpose,
      channel: t.channel,
      email: t.channel === "EMAIL" ? key : null,
      phone: t.channel === "SMS" ? t.value : null,
      userId: args.userId ?? null,
      codeHash,
      expiresAt,
    },
  });

  const send =
    t.channel === "EMAIL"
      ? await sendEmail({
          to: t.value,
          subject: `${code} is your MANEXA verification code`,
          html: otpEmailHtml({ code, purpose: args.purpose, minutes: TTL_MIN }),
          text: `Your MANEXA verification code is ${code}. It expires in ${TTL_MIN} minutes.`,
        })
      : await sendSms({ to: t.value, text: `${code} is your MANEXA verification code. Valid ${TTL_MIN} min.` });

  if (!send.ok) return { ok: false, error: "send_failed" };

  // Expose the code back to the caller ONLY when we didn't actually send it
  // (no provider configured) and we're not in production — so local/dev and
  // tests can complete the flow. Never leak a really-sent code.
  const devCode = send.simulated && env.NODE_ENV !== "production" ? code : undefined;
  if (devCode) logger.info("otp issued (dev)", { purpose: args.purpose, target: key, code });

  return { ok: true, channel: t.channel, simulated: send.simulated, devCode, expiresInMin: TTL_MIN };
}

export type VerifyResult =
  | { ok: true; userId: string | null }
  | { ok: false; error: "expired_or_missing" | "too_many_attempts" | "invalid" };

/** Verify a submitted code against the newest live code for purpose+target. */
export async function verifyOtp(args: {
  purpose: OtpPurpose;
  email?: string | null;
  phone?: string | null;
  code: string;
}): Promise<VerifyResult> {
  const t = resolveTarget(args);
  if (!t) return { ok: false, error: "expired_or_missing" };
  const key = t.value.toLowerCase();

  const row = await prisma.otpCode.findFirst({
    where: {
      purpose: args.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(t.channel === "EMAIL" ? { email: key } : { phone: t.value }),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, error: "expired_or_missing" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  const submitted = hashCode(args.purpose, key, (args.code ?? "").trim());
  if (!constantEq(submitted, row.codeHash)) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "invalid" };
  }
  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true, userId: row.userId ?? null };
}
