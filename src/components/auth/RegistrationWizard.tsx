"use client";

// Premium multi-step onboarding for creating an institution. Wraps the EXISTING
// createInstitutionAction (backward compatible) in one form; steps are shown/
// validated client-side and every field stays in the DOM so the final submit
// posts the complete FormData. No server contract changes.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFormStatus } from "react-dom";

type InstType = { value: string; label: string };
type Fields = {
  institutionName: string;
  type: string;
  country: string;
  state: string;
  city: string;
  website: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  password: string;
  confirm: string;
};

const EMPTY: Fields = {
  institutionName: "", type: "SCHOOL", country: "India", state: "", city: "",
  website: "", ownerName: "", ownerEmail: "", ownerMobile: "", password: "", confirm: "",
};

const STEPS = ["Institution", "Founder", "Review"] as const;

function pwScore(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return { score: s, label: ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"][s] ?? "" };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full gap-2">
      {pending ? "Creating your workspace…" : "Create institution 🎉"}
    </button>
  );
}

export function RegistrationWizard({
  types,
  action,
  err,
}: {
  types: InstType[];
  action: (formData: FormData) => void | Promise<void>;
  err?: string;
}) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Fields>(EMPTY);
  const [touched, setTouched] = useState<string | null>(null);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.ownerEmail);
  const pw = pwScore(f.password);
  const pwPolicyOk = f.password.length >= 8 && /[A-Z]/.test(f.password) && /[a-z]/.test(f.password) && /[0-9]/.test(f.password);
  const match = f.password.length > 0 && f.password === f.confirm;

  function stepError(): string | null {
    if (step === 0) {
      if (f.institutionName.trim().length < 2) return "Enter your institution name";
      if (!f.type) return "Choose an institution type";
    }
    if (step === 1) {
      if (f.ownerName.trim().length < 2) return "Enter the founder's name";
      if (!emailOk) return "Enter a valid email";
      if (f.ownerMobile.trim().length < 7) return "Enter a valid mobile number";
      if (!pwPolicyOk) return "Password needs 8+ chars with upper, lower & a digit";
      if (!match) return "Passwords do not match";
    }
    return null;
  }

  function next() {
    const e = stepError();
    if (e) { setTouched(e); return; }
    setTouched(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() { setTouched(null); setStep((s) => Math.max(0, s - 1)); }

  const typeLabel = types.find((t) => t.value === f.type)?.label ?? f.type;

  return (
    <form action={action}>
      {/* Hidden mirror of every field so FormData is always complete regardless
          of which step is visible. */}
      {(Object.keys(EMPTY) as (keyof Fields)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={f[k]} readOnly />
      ))}

      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i < step ? "bg-accent text-accent-fg" : i === step ? "bg-accent/15 text-accent border border-accent/50" : "bg-elevated text-muted border border-border"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-[11px] ${i === step ? "text-fg" : "text-muted"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 rounded ${i < step ? "bg-accent" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {(err || touched) && (
        <div className="badge badge-error w-full py-2 justify-center mb-4">
          {touched ?? (err && decodeURIComponent(err))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <div>
                <label className="label">Institution name</label>
                <input className="input" value={f.institutionName} onChange={set("institutionName")} placeholder="St. John's Academy" autoFocus />
              </div>
              <div>
                <label className="label">Institution type</label>
                <select className="select" value={f.type} onChange={set("type")}>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Country</label><input className="input" value={f.country} onChange={set("country")} /></div>
                <div><label className="label">State</label><input className="input" value={f.state} onChange={set("state")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">City</label><input className="input" value={f.city} onChange={set("city")} /></div>
                <div><label className="label">Website (optional)</label><input className="input" value={f.website} onChange={set("website")} placeholder="https://…" /></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div><label className="label">Founder name</label><input className="input" value={f.ownerName} onChange={set("ownerName")} autoFocus /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Email</label><input className="input" type="email" value={f.ownerEmail} onChange={set("ownerEmail")} /></div>
                <div><label className="label">Mobile</label><input className="input" value={f.ownerMobile} onChange={set("ownerMobile")} placeholder="+91…" /></div>
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={f.password} onChange={set("password")} />
                {f.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-elevated overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pw.score <= 2 ? "bg-error" : pw.score === 3 ? "bg-warning" : "bg-accent"}`}
                        style={{ width: `${(pw.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-16 text-right">{pw.label}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input className="input" type="password" value={f.confirm} onChange={set("confirm")} />
                {f.confirm && !match && <p className="text-xs text-error mt-1">Passwords do not match</p>}
                {match && <p className="text-xs text-accent mt-1">✓ Passwords match</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="card bg-elevated p-4 space-y-2 text-sm">
                <Row k="Institution" v={f.institutionName} />
                <Row k="Type" v={typeLabel} />
                <Row k="Location" v={[f.city, f.state, f.country].filter(Boolean).join(", ") || "—"} />
                <Row k="Founder" v={f.ownerName} />
                <Row k="Email" v={f.ownerEmail} />
                <Row k="Mobile" v={f.ownerMobile} />
              </div>
              <div className="card border border-accent/30 bg-accent/5 p-4 text-sm">
                <div className="font-medium text-fg mb-1">What happens next</div>
                <ul className="text-muted space-y-1 text-xs">
                  <li>• A unique Institution ID is generated (e.g. <span className="font-mono text-accent">MAN-SCH-100001</span>)</li>
                  <li>• Your founder / admin account is created and signed in</li>
                  <li>• Default classes, roles & permissions are provisioned</li>
                  <li>• You start on a <span className="text-fg">14-day free trial</span> — no card required</li>
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-6">
        {step > 0 && (
          <button type="button" onClick={back} className="btn-secondary flex-1">Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn-primary flex-1">Continue</button>
        ) : (
          <div className="flex-1"><SubmitButton /></div>
        )}
      </div>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="text-fg text-right truncate">{v || "—"}</span>
    </div>
  );
}
