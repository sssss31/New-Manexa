"use client";

// Segmented 6-digit OTP entry: auto-advance, backspace-to-previous, and paste
// distribution. Assembles into a hidden `code` field submitted via the passed
// server action. Numeric + accessible (labelled inputs, inputMode numeric).
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const LEN = 6;

function SubmitBtn({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-cta w-full justify-center" disabled={pending || disabled} aria-disabled={pending || disabled}>
      {pending ? "Verifying…" : "Verify email"}
    </button>
  );
}

export function OtpForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setAt(i: number, val: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "");
    if (!v) {
      setAt(i, "");
      return;
    }
    // take the last typed digit; advance to the next box
    setAt(i, v[v.length - 1]);
    if (i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setAt(i - 1, "");
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
    if (!text) return;
    e.preventDefault();
    const next = Array(LEN).fill("");
    for (let k = 0; k < text.length; k++) next[k] = text[k];
    setDigits(next);
    refs.current[Math.min(text.length, LEN - 1)]?.focus();
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="code" value={code} />
      <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            className="w-11 h-14 text-center text-xl font-semibold rounded-xl bg-elevated border border-border text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        ))}
      </div>
      <SubmitBtn disabled={code.length !== LEN} />
    </form>
  );
}
