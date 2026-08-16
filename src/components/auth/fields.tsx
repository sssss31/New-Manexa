"use client";

// Shared premium auth primitives — floating-label glass fields, a password
// field with show/hide + strength + live rules, and a gradient submit button
// with a built-in loading state. Brand tokens only (no new palette).

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

/** Floating-label glass input with a leading icon and error/success states. */
export function AuthField({
  label, name, type = "text", value, onChange, icon, autoFocus, autoComplete, error, inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
  icon?: ReactNode;
  autoFocus?: boolean;
  autoComplete?: string;
  error?: string | null;
  inputMode?: "text" | "email" | "tel" | "numeric";
}) {
  const id = useId();
  const controlled = typeof onChange === "function";
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon ?? <MailIcon />}</span>
        <input
          id={id}
          name={name}
          type={type}
          {...(controlled ? { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange!(e.target.value) } : { defaultValue: value })}
          placeholder=" "
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? "true" : undefined}
          aria-label={label}
          className="peer auth-input"
        />
        <label htmlFor={id} className="auth-float-label">{label}</label>
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

const RULES = [
  { key: "len", label: "8+ characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "Uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "Lowercase", test: (p: string) => /[a-z]/.test(p) },
  { key: "num", label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { key: "sym", label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Password field: show/hide, optional live strength meter + rule checklist. */
export function PasswordField({
  label = "Password", name, value, onChange, autoComplete = "current-password",
  showMeter = false, autoFocus,
}: {
  label?: string;
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  autoComplete?: string;
  showMeter?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const controlled = typeof onChange === "function";
  const pw = value ?? "";
  const passed = RULES.filter((r) => r.test(pw)).length;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><LockIcon /></span>
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          {...(controlled ? { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange!(e.target.value) } : { defaultValue: value })}
          placeholder=" "
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-label={label}
          className="peer auth-input pr-10"
        />
        <label htmlFor={id} className="auth-float-label">{label}</label>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors p-1"
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" /><path d="M9.9 4.2A10 10 0 0 1 12 4c5 0 9 5 9 8a12 12 0 0 1-2.2 3M6.6 6.6C4 8.2 3 11 3 12c0 1 1 3 3 5" strokeLinecap="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
          )}
        </button>
      </div>

      {showMeter && pw.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
              <div
                className={`h-full rounded-full transition-all ${passed <= 2 ? "bg-error" : passed === 3 ? "bg-warning" : "bg-accent"}`}
                style={{ width: `${(passed / RULES.length) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs text-muted">
              {["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"][passed]}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {RULES.map((r) => {
              const ok = r.test(pw);
              return (
                <li key={r.key} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-success" : "text-subtle"}`}>
                  <span>{ok ? "✓" : "○"}</span> {r.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Gradient submit button with a built-in pending/loading state. */
export function AuthSubmit({ children, idleLabel }: { children?: ReactNode; idleLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="auth-cta">
      {pending ? (
        <>
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
          </svg>
          Please wait…
        </>
      ) : (children ?? idleLabel)}
    </button>
  );
}

export { MailIcon, LockIcon };
