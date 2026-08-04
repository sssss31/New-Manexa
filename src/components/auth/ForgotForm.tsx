"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AuthField, AuthSubmit, MailIcon } from "./fields";

export function ForgotForm({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send reset instructions.</p>
      </div>
      <form action={action} className="space-y-4">
        <AuthField label="Email" name="email" type="email" icon={<MailIcon />} autoComplete="email" inputMode="email" autoFocus />
        <AuthSubmit idleLabel="Send reset link" />
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">← Back to sign in</Link>
      </p>
    </motion.div>
  );
}
