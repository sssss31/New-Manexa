"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PasswordField, AuthSubmit } from "./fields";

export function ResetForm({
  action, token, errorMessage,
}: {
  action: (fd: FormData) => void | Promise<void>;
  token: string;
  errorMessage?: string | null;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const match = pw.length > 0 && pw === confirm;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">Choose a strong password for your account.</p>
      </div>

      {errorMessage && (
        <div role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error">{errorMessage}</div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <PasswordField name="password" label="New password" autoComplete="new-password" value={pw} onChange={setPw} showMeter autoFocus />
        <div>
          <PasswordField name="confirm" label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          {confirm && (
            <p className={`mt-1 text-xs ${match ? "text-success" : "text-error"}`}>
              {match ? "✓ Passwords match" : "✕ Passwords don't match"}
            </p>
          )}
        </div>
        <AuthSubmit idleLabel="Update password" />
      </form>
    </motion.div>
  );
}
