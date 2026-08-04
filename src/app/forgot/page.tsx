import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { requestResetAction } from "./actions";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const email = sp.email ? decodeURIComponent(sp.email) : "";

  return (
    <AuthShell>
      {sp.sent ? (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Check your inbox</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            If an account exists for {email ? <span className="text-fg">{email}</span> : "that email"}, we&apos;ve sent
            password reset instructions. The link expires in 1 hour.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <a href="https://mail.google.com" target="_blank" rel="noreferrer" className="btn-secondary justify-center">Open Gmail</a>
            <a href="https://outlook.live.com" target="_blank" rel="noreferrer" className="btn-secondary justify-center">Open Outlook</a>
          </div>
          <p className="mt-5 text-sm text-muted">
            Didn&apos;t get it? <Link href="/forgot" className="text-accent hover:underline">Try another email</Link>
          </p>
          <p className="mt-2 text-sm text-muted">
            <Link href="/login" className="hover:text-fg">← Back to sign in</Link>
          </p>
        </div>
      ) : (
        <ForgotForm action={requestResetAction} />
      )}
    </AuthShell>
  );
}
