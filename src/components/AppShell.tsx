import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CommandK, CommandItem } from "./CommandK";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";

export type NavItemSpec = {
  href: string;
  label: string;
  icon?: ReactNode;
  section?: string;
};

export async function AppShell({
  role,
  displayName,
  tenantName,
  nav,
  currentPath,
  userId,
  children,
}: {
  role: string;
  displayName: string;
  tenantName?: string | null;
  nav: NavItemSpec[];
  currentPath?: string;
  userId?: string;
  children: ReactNode;
}) {
  const groups = new Map<string, NavItemSpec[]>();
  for (const item of nav) {
    const s = item.section ?? "";
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(item);
  }

  const commandItems: CommandItem[] = nav.map((n) => ({
    label: n.label,
    href: n.href,
    section: n.section,
  }));

  const unread = userId
    ? await prisma.notification.count({ where: { userId, readAt: null } })
    : 0;

  return (
    <div className="min-h-screen flex bg-bg relative">
      {/* App-wide aurora canvas — very subtle, sits behind every screen */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="dash-orb dash-orb-green w-[600px] h-[600px] -top-48 -left-40" />
        <div className="dash-orb dash-orb-navy w-[520px] h-[520px] top-1/3 right-[-160px]" />
        <div className="dash-orb dash-orb-mint w-[420px] h-[420px] bottom-[-120px] left-1/3 opacity-[0.10]" />
      </div>
      <a href="#main" className="sr-skip">Skip to content</a>

      <aside className="w-64 shrink-0 border-r border-border bg-surface/70 backdrop-blur-xl flex flex-col relative z-10">
        <div className="p-4 border-b border-border">
          <Logo />
          {tenantName && (
            <div className="mt-3 text-xs text-muted uppercase tracking-wider">{tenantName}</div>
          )}
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-4" aria-label="Primary">
          {Array.from(groups.entries()).map(([section, items]) => (
            <div key={section}>
              {section && <div className="section-h px-3 mb-1.5">{section}</div>}
              <div className="space-y-0.5">
                {items.map((it) => {
                  const active = currentPath
                    ? currentPath === it.href || currentPath.startsWith(it.href + "/")
                    : false;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={`nav-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      {it.icon && (
                        <span className="w-4 h-4 inline-flex items-center justify-center">{it.icon}</span>
                      )}
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-elevated border border-border">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
              {displayName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-fg truncate">{displayName}</div>
              <div className="text-xs text-muted">{role.replace(/_/g, " ")}</div>
            </div>
            <form action={logoutAction}>
              <button className="btn-ghost w-8 h-8 p-0" title="Log out" aria-label="Log out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-14 border-b border-border bg-surface/60 backdrop-blur-xl px-6 flex items-center justify-between gap-3">
          <div className="text-sm text-muted hidden lg:block">MANEXA · AI-Powered School Management</div>
          <div className="flex items-center gap-2 ml-auto">
            <CommandK items={commandItems} />
            <Link
              href="/notifications"
              className="btn-ghost w-9 h-9 p-0 relative"
              aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
              title="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
                <path d="M10 21a2 2 0 0 0 4 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-fg text-[10px] font-semibold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div id="main" className="flex-1 p-6 max-w-[1400px] w-full mx-auto animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
