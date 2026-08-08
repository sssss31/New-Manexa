import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, roleHome } from "@/lib/auth";
import { listSessions, currentSessionToken, parseUserAgent } from "@/lib/sessions";
import { relative } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { StatusBadge, Tag } from "@/components/ui";
import { revokeSessionAction, revokeOthersAction } from "./actions";

export const dynamic = "force-dynamic";

function DeviceGlyph({ kind }: { kind: "Mobile" | "Tablet" | "Desktop" }) {
  if (kind === "Mobile")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" strokeLinecap="round" />
      </svg>
    );
  if (kind === "Tablet")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border last:border-0">
      <span className="text-xs uppercase tracking-wider text-subtle">{label}</span>
      <span className="text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; err?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const token = await currentSessionToken();
  const [sessions, events] = await Promise.all([
    listSessions(user.id, token),
    prisma.loginEvent.findMany({
      where: { userId: user.id },
      orderBy: { at: "desc" },
      take: 8,
      select: { id: true, at: true, ip: true, userAgent: true, outcome: true },
    }),
  ]);
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="min-h-screen bg-bg relative">
      {/* aurora canvas — same language as the app shell */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="dash-orb dash-orb-green w-[560px] h-[560px] -top-48 -left-40" />
        <div className="dash-orb dash-orb-navy w-[480px] h-[480px] top-1/3 right-[-160px]" />
      </div>

      <header className="relative z-10 border-b border-border bg-surface/70 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link href={roleHome(user.role)} className="btn-secondary text-xs">← Back to portal</Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8 animate-fade-up space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Account &amp; security</h1>
          <p className="text-sm text-muted mt-1">Your identity, devices and sign-in activity — all in one place.</p>
        </div>

        {sp.notice && (
          <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
            {decodeURIComponent(sp.notice)}
          </div>
        )}
        {sp.err && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
            {decodeURIComponent(sp.err)}
          </div>
        )}

        {/* Identity */}
        <section className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-fg">Identity</h2>
            <Tag tone="muted">Read-only</Tag>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8">
            <KV label="Global user ID"><span className="font-mono text-xs text-muted break-all">{user.id}</span></KV>
            <KV label="Role"><span className="capitalize">{user.role.replace(/_/g, " ").toLowerCase()}</span></KV>
            <KV label="Institution">
              {user.tenant ? (
                <>
                  {user.tenant.name}{" "}
                  <span className="font-mono text-xs text-subtle">· {user.tenant.institutionId}</span>
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </KV>
            <KV label="Account status"><StatusBadge status={user.status} /></KV>
            <KV label="Email">
              <span className="inline-flex items-center gap-2">
                {user.email}
                {user.emailVerifiedAt ? (
                  <Tag tone="success">Verified</Tag>
                ) : (
                  <>
                    <Tag tone="warning">Unverified</Tag>
                    <Link href="/verify-email" className="text-xs text-accent hover:underline">Verify now →</Link>
                  </>
                )}
              </span>
            </KV>
            <KV label="Phone">{user.phone || <span className="text-subtle">Not added</span>}</KV>
            <KV label="Sign-in method">
              <span className="capitalize">{user.provider.toLowerCase()}</span>
              {user.mfaEnabled ? <Tag tone="success">MFA on</Tag> : null}
            </KV>
            <KV label="Member since">{new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</KV>
          </div>
        </section>

        {/* Active sessions */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">Active sessions</h2>
              <Tag tone="muted">{sessions.length} device{sessions.length === 1 ? "" : "s"}</Tag>
            </div>
            {otherCount > 0 && (
              <form action={revokeOthersAction}>
                <button className="btn-ghost text-xs text-error hover:bg-error/10" title="Sign out of all other devices">
                  Log out other devices
                </button>
              </form>
            )}
          </div>
          <p className="text-xs text-muted mb-4">Signed-in devices with a live session. Revoke any you don&apos;t recognise.</p>

          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  s.current ? "border-accent/40 bg-accent/[0.06]" : "border-border bg-elevated/40"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.current ? "bg-accent/15 text-accent" : "bg-surface text-muted"}`}>
                  <DeviceGlyph kind={s.device.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-fg font-medium">
                      {s.device.browser} on {s.device.os}
                    </span>
                    <Tag tone="muted">{s.device.kind}</Tag>
                    {s.current && <Tag tone="success">This device</Tag>}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {s.ip ? <span className="font-mono">{s.ip}</span> : "Unknown IP"} · active {relative(s.lastSeenAt)} · signed in {relative(s.createdAt)}
                  </div>
                </div>
                <form action={revokeSessionAction} className="shrink-0">
                  <input type="hidden" name="sessionId" value={s.id} />
                  {s.current && <input type="hidden" name="current" value="1" />}
                  <button
                    className="btn-ghost text-xs text-error hover:bg-error/10"
                    title={s.current ? "Sign out of this device" : "Revoke this session"}
                  >
                    {s.current ? "Sign out" : "Revoke"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent login activity */}
        <section className="glass-card p-6">
          <h2 className="text-sm font-semibold text-fg mb-1">Recent sign-in activity</h2>
          <p className="text-xs text-muted mb-4">The last {events.length} sign-in attempts on your account.</p>
          {events.length === 0 ? (
            <div className="text-sm text-muted">No sign-in activity recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const d = parseUserAgent(e.userAgent);
                const ok = e.outcome === "SUCCESS";
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className={`dot shrink-0 ${ok ? "" : "!bg-error"}`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-fg">{ok ? "Successful sign-in" : "Failed attempt"}</span>
                      <span className="text-xs text-muted"> · {d.browser} on {d.os}</span>
                    </div>
                    <span className="text-xs text-subtle font-mono hidden sm:inline">{e.ip ?? "—"}</span>
                    <span className="text-xs text-subtle whitespace-nowrap w-20 text-right">{relative(e.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
