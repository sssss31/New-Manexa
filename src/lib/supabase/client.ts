"use client";

// Browser-side Supabase client — used ONLY to kick off the Google OAuth
// handshake from the login page. It is not the app's session system: after
// Google returns, /auth/callback bridges the identity into the existing
// manexa_session (see src/lib/auth.ts). Returns null when Supabase Auth isn't
// configured, so the login page renders exactly as before.
import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both Supabase URL + anon key are present at build time. */
export function googleAuthEnabled(): boolean {
  return !!(URL && ANON);
}

export function getSupabaseBrowser() {
  if (!URL || !ANON) return null;
  return createBrowserClient(URL, ANON);
}
