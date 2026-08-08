import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, roleHome } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

// Google OAuth callback. Supabase Auth handles the Google handshake; here we
// exchange the code for a Supabase session, read the verified email, and BRIDGE
// it into the app's existing session system (manexa_session) — we do NOT switch
// the app onto Supabase sessions. Google sign-in only works for emails that
// already have an active Manexa account; unknown emails are rejected (no user,
// tenant, or role is ever created here).
export const dynamic = "force-dynamic";

function back(request: Request, err: string) {
  return NextResponse.redirect(new URL(`/login?err=${err}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  // User cancelled / denied consent on Google's screen.
  if (oauthError) return back(request, oauthError === "access_denied" ? "google_cancelled" : "google_failed");
  if (!code) return back(request, "google_failed");

  const supabase = await getSupabaseServer();
  if (!supabase) return back(request, "google_failed");

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) {
      logger.warn("google callback: code exchange failed", { reason: error?.message });
      return back(request, "google_failed");
    }

    // Bridge: the email must map to an existing, active Manexa account.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      // Reject cleanly — clear the Supabase session so nothing dangles.
      await supabase.auth.signOut().catch(() => {});
      after(() => audit({ action: "GOOGLE_LOGIN_REJECTED", entity: "User", detail: email }));
      return back(request, "google_nouser");
    }

    // Mint the EXISTING session the whole app already understands. Capture the
    // same device meta as the password path so it shows in Account & security.
    const meta = {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    };
    await createSession(user.id, meta);

    after(() => {
      prisma.loginEvent
        .create({ data: { userId: user.id, tenantId: user.tenantId, ...meta, outcome: "SUCCESS" } })
        .catch(() => {});
      audit({ tenantId: user.tenantId, actorId: user.id, action: "GOOGLE_LOGIN", entity: "User", entityId: user.id, detail: email });
    });

    return NextResponse.redirect(new URL(roleHome(user.role), request.url));
  } catch (e) {
    logger.error("google callback failed", e, { route: "auth/callback" });
    return back(request, "google_failed");
  }
}
