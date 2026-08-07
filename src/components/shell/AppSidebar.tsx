"use client";

// Enterprise sidebar: collapsible (persisted), searchable, with an animated
// active indicator. Icons are passed in as ReactNodes from the server layout.
// Uses the Phase-1 design-system motion + the existing brand/glass classes.

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export type NavItem = { href: string; label: string; icon?: ReactNode; section?: string };

const STORAGE = "mnx-sidebar-collapsed";

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppSidebar({
  nav, activeHref, role, displayName, tenantName, logout, quickCreateHref,
}: {
  nav: NavItem[];
  activeHref?: string;
  role: string;
  displayName: string;
  tenantName?: string | null;
  logout: () => void | Promise<void>;
  quickCreateHref?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE) === "1"); } catch {}
    setReady(true);
  }, []);
  function toggle() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem(STORAGE, n ? "1" : "0"); } catch {} return n; });
  }

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

  return (
    <aside
      className={`${collapsed ? "w-[68px]" : "w-64"} shrink-0 border-r border-border bg-surface/70 backdrop-blur-xl flex flex-col relative z-10 transition-[width] duration-200`}
      style={{ visibility: ready ? "visible" : "visible" }}
      data-collapsed={collapsed}
    >
      {/* Brand + collapse toggle */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Link href="/" aria-label="Home" className="flex items-center min-w-0">
          {collapsed ? <Logo showWord={false} size={26} /> : <Logo />}
        </Link>
        <button
          onClick={toggle}
          className="btn-ghost w-7 h-7 p-0 ml-auto shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={collapsed ? "rotate-180" : ""}>
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!collapsed && tenantName && (
        <div className="px-4 pt-3 text-xs text-muted uppercase tracking-wider truncate">{tenantName}</div>
      )}

      {/* Quick create + search */}
      <div className={`px-3 pt-3 space-y-2 ${collapsed ? "px-2" : ""}`}>
        {quickCreateHref && (
          <Link href={quickCreateHref} className={`btn-primary ${collapsed ? "w-11 h-9 p-0 justify-center" : "w-full"} gap-1.5 text-sm`} title="Quick create">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            {!collapsed && "Quick create"}
          </Link>
        )}
        {!collapsed && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter menu…"
            aria-label="Filter navigation"
            className="input py-1.5 text-sm"
          />
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto space-y-4 py-3 ${collapsed ? "px-2" : "px-3"}`} aria-label="Primary">
        {groups.map(([section, items]) => (
          <div key={section}>
            {section && !collapsed && <div className="section-h px-3 mb-1.5">{section}</div>}
            <div className="space-y-0.5">
              {items.map((it) => {
                const active = it.href === activeHref;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? it.label : undefined}
                    className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                      collapsed ? "justify-center px-0 w-11 mx-auto" : ""
                    } ${active ? "text-accent" : "text-muted hover:text-fg hover:bg-elevated/60"}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-accent/12 ring-1 ring-accent/25"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    {it.icon && <span className="relative w-4 h-4 inline-flex items-center justify-center shrink-0">{it.icon}</span>}
                    {!collapsed && <span className="relative truncate">{it.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && !collapsed && (
          <div className="px-3 text-xs text-muted">No menu items match “{query}”.</div>
        )}
      </nav>

      {/* User footer */}
      <div className={`border-t border-border ${collapsed ? "p-2 space-y-1.5" : "p-3"}`}>
        <div className={`flex items-center gap-2 rounded-xl bg-elevated border border-border ${collapsed ? "p-1.5 justify-center" : "p-2"}`}>
          <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">{initials}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm text-fg truncate">{displayName}</div>
              <div className="text-xs text-muted">{role.replace(/_/g, " ").toLowerCase()}</div>
            </div>
          )}
          {!collapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <Link href="/account/security" className="btn-ghost w-8 h-8 p-0" title="Account & security" aria-label="Account & security">
                <ShieldIcon />
              </Link>
              <form action={logout}>
                <button className="btn-ghost w-8 h-8 p-0" title="Log out" aria-label="Log out"><LogoutIcon /></button>
              </form>
            </div>
          )}
        </div>
        {collapsed && (
          <div className="flex flex-col items-center gap-1">
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
}
