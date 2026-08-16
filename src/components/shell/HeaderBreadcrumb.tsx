"use client";

// Route-driven breadcrumb. Like the sidebar, it derives the active item from the
// LIVE pathname (usePathname) instead of a server-computed prop, so it never goes
// stale on client-side navigation. Takes a serializable nav list (no icons).

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Crumb = { href: string; label: string; section?: string };

export function HeaderBreadcrumb({ nav }: { nav: Crumb[] }) {
  const pathname = usePathname();
  const active = nav
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .reduce<Crumb | null>((best, n) => (!best || n.href.length > best.href.length ? n : best), null);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
      <Link href="/" className="text-muted hover:text-fg shrink-0">MANEXA</Link>
      {active?.section && (
        <>
          <span className="text-subtle">/</span>
          <span className="text-muted hidden sm:inline">{active.section}</span>
        </>
      )}
      {active && (
        <>
          <span className="text-subtle">/</span>
          <span className="text-fg font-medium truncate">{active.label}</span>
        </>
      )}
    </nav>
  );
}
