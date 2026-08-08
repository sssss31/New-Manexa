import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client, used only inside /auth/callback to exchange the
// OAuth code for a Supabase session (PKCE verifier lives in cookies written by
// the browser client). Reads/writes the request cookie store so the exchange
// persists. Never used for app authorization — that stays on manexa_session.
export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a context where cookies are read-only — safe to ignore;
          // the callback route handler is writable, which is all we need.
        }
      },
    },
  });
}
