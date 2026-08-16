"use client";

// Enterprise sidebar: collapsible (persisted, desktop), searchable, role-aware,
// with a route-driven active indicator. The single source of truth for the
// active item is the LIVE pathname (usePathname) — never a server-computed prop
// that goes stale on client-side navigation. `activeHref` is accepted only as a
// first-paint SSR fallback. Icons arrive as ReactNodes from the server layout.
//
// Responsive: static column on lg+, slide-in drawer with a hamburger below lg.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export type NavItem = { href: string; label: string; icon?: ReactNode; section?: string };

const STORAGE = "mnx-sidebar-collapsed";

/**
 * Resolve the active nav href from the live pathname using LONGEST-PREFIX match,
 * so `/institution` (Cockpit) doesn't stay lit on `/institution/students`, and a
 * deep link like `/teacher/attendance/live/xyz` still lights "Face Attendance".
 */
function resolveActive(nav: NavItem[], pathname: string | null, fallback?: string): string {
  if (!pathname) return fallback ?? "";
  const matches = nav.filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  if (matches.length === 0) return fallback ?? "";
  return matches.reduce((best, n) => (n.href.length > best.href.length ? n : best)).href;
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

export function AppSidebar({
  nav, activeHref, role, displayName, tenantName, logout, quickCreateHref,
}: {
  nav: NavItem[];
  /** SSR first-paint fallback only; the live pathname overrides it. */
  activeHref?: string;
  role: string;
  displayName: string;
  tenantName?: string | null;
  logout: () => void | Promise<void>;
  quickCreateHref?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE) === "1"); } catch {}
  }, []);

  // Close the mobile drawer whenever the route changes (navigation happened).
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  function toggleCollapsed() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem(STORAGE, n ? "1" : "0"); } catch {} return n; });
  }

  const active = resolveActive(nav, pathname, activeHref);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : nav;
    const map = new Map<string, NavItem[]>();
    for (const it of filtered) {
      const s = it.section ?? "";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(it);
    }
    return Array.from(map.entries());
  }, [nav, query]);

  const initials = displayName.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  // On mobile the drawer is always expanded (collapse is a desktop affordance).
  const isCollapsed = collapsed;

  const aside = (
    <aside
      className={[
        isCollapsed ? "lg:w-[68px]" : "lg:w-64",
        "w-64 shrink-0 border-r border-border bg-surface/70 backdrop-blur-xl flex flex-col",
        "h-full lg:h-auto lg:relative lg:z-10 transition-[width] duration-200",
      ].join(" ")}
      data-collapsed={isCollapsed}
    >
      {/* Brand + collapse toggle */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Link href="/" aria-label="Home" className="flex items-center min-w-0">
          {isCollapsed ? <Logo showWord={false} size={26} /> : <Logo />}
        </Link>
        {/* Desktop collapse */}
        <button
          onClick={toggleCollapsed}
          className="btn-ghost w-7 h-7 p-0 ml-auto shrink-0 hidden lg:inline-flex"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={isCollapsed ? "rotate-180" : ""}>
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="btn-ghost w-7 h-7 p-0 ml-auto shrink-0 lg:hidden"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </div>

      {!isCollapsed && tenantName && (
        <div className="px-4 pt-3 text-xs text-muted uppercase tracking-wider truncate">{tenantName}</div>
      )}

      {/* Quick create + search */}
      <div className={`px-3 pt-3 space-y-2 ${isCollapsed ? "lg:px-2" : ""}`}>
        {quickCreateHref && (
          <Link href={quickCreateHref} className={`btn-primary ${isCollapsed ? "lg:w-11 lg:h-9 lg:p-0 lg:justify-center w-full" : "w-full"} gap-1.5 text-sm`} title="Quick create">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            <span className={isCollapsed ? "lg:hidden" : ""}>Quick create</span>
          </Link>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter menu…"
          aria-label="Filter navigation"
          className={`input py-1.5 text-sm ${isCollapsed ? "lg:hidden" : ""}`}
        />
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto space-y-4 py-3 ${isCollapsed ? "lg:px-2 px-3" : "px-3"}`} aria-label="Primary">
        {groups.map(([section, items]) => (
          <div key={section}>
            {section && <div className={`section-h px-3 mb-1.5 ${isCollapsed ? "lg:hidden" : ""}`}>{section}</div>}
            <div className="space-y-0.5">
              {items.map((it) => {
                const isActive = it.href === active;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={isActive ? "page" : undefined}
                    title={isCollapsed ? it.label : undefined}
                    className={[
                      "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
                      "transition-[color,background-color] duration-150",
                      isCollapsed ? "lg:justify-center lg:px-0 lg:w-11 lg:mx-auto" : "",
                      isActive
                        ? "text-fg font-medium"
                        : "text-muted hover:text-fg hover:bg-elevated/60",
                    ].join(" ")}
                  >
                    {/* Active surface — subtle neon glass + thin ring + soft glow.
                        Static (no shared-layout animation) so the desktop copy and
                        the mobile drawer copy never collide on a duplicate layoutId. */}
                    {isActive && (
                      <>
                        <span
                          className="absolute inset-0 rounded-xl bg-accent/10 ring-1 ring-accent/25"
                          style={{ boxShadow: "0 0 18px -8px rgb(var(--accent) / 0.45)" }}
                          aria-hidden
                        />
                        {/* Left neon indicator bar */}
                        <span
                          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent ${isCollapsed ? "lg:hidden" : ""}`}
                          aria-hidden
                        />
                      </>
                    )}
                    {it.icon && (
                      <span
                        className={[
                          // 20px box, icon forced to 19px + centered (container
                          // dictates size regardless of the passed ReactNode).
                          "relative w-5 h-5 inline-flex items-center justify-center shrink-0 transition-colors",
                          "[&>svg]:w-[19px] [&>svg]:h-[19px]",
                          isActive ? "text-accent" : "text-muted group-hover:text-fg",
                        ].join(" ")}
                      >
                        {it.icon}
                      </span>
                    )}
                    <span className={`relative truncate ${isCollapsed ? "lg:hidden" : ""}`}>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className={`px-3 text-xs text-muted ${isCollapsed ? "lg:hidden" : ""}`}>No menu items match “{query}”.</div>
        )}
      </nav>

      {/* User footer */}
      <div className={`border-t border-border ${isCollapsed ? "lg:p-2 lg:space-y-1.5 p-3" : "p-3"}`}>
        <div className={`flex items-center gap-2 rounded-xl bg-elevated border border-border ${isCollapsed ? "lg:p-1.5 lg:justify-center p-2" : "p-2"}`}>
          <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">{initials}</div>
          <div className={`min-w-0 flex-1 ${isCollapsed ? "lg:hidden" : ""}`}>
            <div className="text-sm text-fg truncate">{displayName}</div>
            <div className="text-xs text-muted">{role.replace(/_/g, " ").toLowerCase()}</div>
          </div>
          <div className={`flex items-center gap-1 shrink-0 ${isCollapsed ? "lg:hidden" : ""}`}>
            <Link href="/account/security" className="btn-ghost w-8 h-8 p-0" title="Account & security" aria-label="Account & security">
              <ShieldIcon />
            </Link>
            <form action={logout}>
              <button className="btn-ghost w-8 h-8 p-0" title="Log out" aria-label="Log out"><LogoutIcon /></button>
            </form>
          </div>
        </div>
        {isCollapsed && (
          <div className="hidden lg:flex flex-col items-center gap-1">
            <Link href="/account/security" className="btn-ghost w-9 h-9 p-0" title="Account & security" aria-label="Account & security">
              <ShieldIcon />
            </Link>
            <form action={logout}>
              <button className="btn-ghost w-9 h-9 p-0" title="Log out" aria-label="Log out"><LogoutIcon /></button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger — fixed, only below lg. */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="btn-ghost lg:hidden fixed top-2.5 left-3 z-40 w-9 h-9 p-0 bg-surface/80 backdrop-blur-xl border border-border"
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        aria-controls="app-nav-drawer"
      >
        <MenuIcon />
      </button>

      {/* Desktop: static column. */}
      <div className="hidden lg:flex">{aside}</div>

      {/* Mobile: slide-in drawer + backdrop. */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden" id="app-nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-64"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              {aside}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
