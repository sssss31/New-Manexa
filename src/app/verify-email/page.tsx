import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { emailEnabled } from "@/lib/comms";
import { DEV_OTP_COOKIE } from "@/lib/otp";
import { AuthShell } from "@/components/auth/AuthShell";
import { OtpForm } from "@/components/auth/OtpForm";
import { sendVerifyCodeAction, verifyCodeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const devCode = (await cookies()).get(DEV_OTP_COOKIE)?.value;

  // Already verified — short-circuit to a confirmation.
  if (user.emailVerifiedAt) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/12 text-success">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Email verified</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            <span className="text-fg">{user.email}</span> is confirmed. You&apos;re all set.
          </p>
          <p className="mt-6 text-sm text-muted">
            <Link href="/account/security" className="text-accent hover:underline">Go to Account &amp; security →</Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Verify your email</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {sent ? (
            <>We sent a 6-digit code to <span className="text-fg">{user.email}</span>. Enter it below.</>
          ) : (
            <>Confirm <span className="text-fg">{user.email}</span> to secure your account and unlock notifications.</>
          )}
        </p>
      </div>

      {sp.err && (
        <div className="mt-5 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {decodeURIComponent(sp.err)}
        </div>
      )}

      {devCode && (
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="font-medium">Dev mode</span> — no email provider configured. Your code is{" "}
          <span className="font-mono font-semibold tracking-widest">{devCode}</span>.
          <span className="block text-xs opacity-80 mt-0.5">Set <code>RESEND_API_KEY</code> to send real email.</span>
        </div>
      )}

      <div className="mt-6">
        {sent ? (
          <>
            <OtpForm action={verifyCodeAction} />
            <form action={sendVerifyCodeAction} className="mt-4 text-center">
              <button className="text-sm text-muted hover:text-fg" type="submit">
                Didn&apos;t get it? <span className="text-accent">Resend code</span>
              </button>
            </form>
          </>
        ) : (
          <form action={sendVerifyCodeAction}>
            <button type="submit" className="auth-cta w-full justify-center">
              {emailEnabled() ? "Email me a code" : "Send verification code"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/account/security" className="hover:text-fg">← Back to account</Link>
      </p>
    </AuthShell>
  );
}
