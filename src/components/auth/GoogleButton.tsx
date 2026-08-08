"use client";

// "Continue with Google" — starts the Supabase Google OAuth handshake and
// redirects to /auth/callback, which bridges the identity into the existing
// manexa_session. Styled with the existing btn-secondary so it matches the
// login page. Only rendered when Supabase Auth is configured.
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setErr(null);
    setLoading(true);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setErr("Google sign-in isn't configured.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErr("Couldn't start Google sign-in. Please try again.");
      setLoading(false);
    }
    // On success the browser is redirected to Google — nothing else to do.
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="btn-secondary w-full justify-center gap-2.5"
      >
        <GoogleGlyph />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {err && (
        <p role="alert" className="mt-2 text-center text-xs text-error">
          {err}
        </p>
      )}
    </div>
  );
}
