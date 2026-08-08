"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AuthField, PasswordField, AuthSubmit, MailIcon } from "./fields";
import { GoogleButton } from "./GoogleButton";

export function LoginForm({
  action, errorMessage, notice, defaultEmail = "", demoMode = false, googleEnabled = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  errorMessage?: string | null;
  notice?: string | null;
  defaultEmail?: string;
  demoMode?: boolean;
  googleEnabled?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your MANEXA portal.</p>
      </div>

      {errorMessage && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
          {errorMessage}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-accent">{notice}</div>
      )}

      <form action={action} className="space-y-4">
        <AuthField label="Email" name="email" type="email" icon={<MailIcon />} value={defaultEmail} autoComplete="email" inputMode="email" autoFocus />
        <PasswordField name="password" autoComplete="current-password" />

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded border-border bg-elevated accent-[color:rgb(var(--accent))]" />
            Remember me
          </label>
          <Link href="/forgot" className="text-sm text-accent hover:underline">Forgot password?</Link>
        </div>

        <AuthSubmit idleLabel="Sign in" />
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-subtle" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton />
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        New to MANEXA?{" "}
        <Link href="/signup?tab=create" className="text-accent hover:underline">Create an institution</Link>
        {" "}or{" "}
        <Link href="/signup?tab=join" className="text-accent hover:underline">join one</Link>
      </p>

      {demoMode && (
        <p className="mt-3 text-center text-xs text-subtle">
          Demo: <span className="font-mono text-muted">admin@stjohns.manexa.test</span> · <span className="font-mono text-muted">password123</span>
        </p>
      )}
    </motion.div>
  );
}
