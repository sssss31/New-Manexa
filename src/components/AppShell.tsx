import { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { CommandK, CommandItem } from "./CommandK";
import { LiveBell } from "./LiveBell";
import { AppSidebar } from "./shell/AppSidebar";
import { HeaderBreadcrumb } from "./shell/HeaderBreadcrumb";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";

export type NavItemSpec = {
  href: string;
  label: string;
  icon?: ReactNode;
  section?: string;
};

// A sensible primary create/action per role for the sidebar "Quick create".
const QUICK_CREATE: Record<string, string> = {
  INSTITUTION_ADMIN: "/institution/leads",
  PRINCIPAL: "/institution/leads",
  TEACHER: "/teacher/attendance",
  ACCOUNTANT: "/accounts/invoices",
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
  const commandItems: CommandItem[] = nav.map((n) => ({ label: n.label, href: n.href, section: n.section }));
  // Serializable crumb list (icons dropped) for the client breadcrumb.
  const crumbs = nav.map((n) => ({ href: n.href, label: n.label, section: n.section }));

  const unread = userId ? await prisma.notification.count({ where: { userId, readAt: null } }) : 0;

  // SSR first-paint fallback for the sidebar's active item. The client resolves
  // the live value from usePathname, so this only matters before hydration and
  // never goes stale on client-side navigation.
  const activeHref =
    nav
      .filter((n) => currentPath && (currentPath === n.href || currentPath.startsWith(n.href + "/")))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";

  return (
    <div className="min-h-screen flex bg-bg relative">
      {/* App-wide aurora canvas — very subtle, sits behind every screen */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="dash-orb dash-orb-green w-[600px] h-[600px] -top-48 -left-40" />
        <div className="dash-orb dash-orb-dim w-[520px] h-[520px] top-1/3 right-[-160px]" />
        <div className="dash-orb dash-orb-mint w-[420px] h-[420px] bottom-[-120px] left-1/3 opacity-[0.10]" />
      </div>
      <a href="#main" className="sr-skip">Skip to content</a>

      <AppSidebar
        nav={nav}
        activeHref={activeHref}
        role={role}
        displayName={displayName}
        tenantName={tenantName}
        logout={logoutAction}
        quickCreateHref={QUICK_CREATE[role]}
      />

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* pl-16 on mobile clears the fixed sidebar hamburger; normal on lg+. */}
        <header className="h-14 border-b border-border bg-surface/60 backdrop-blur-xl pl-16 pr-4 lg:px-6 flex items-center justify-between gap-3">
          <HeaderBreadcrumb nav={crumbs} />
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <CommandK items={commandItems} />
            <LiveBell initialUnread={unread} />
            <ThemeToggle />
          </div>
        </header>
        <div id="main" className="flex-1 p-6 max-w-content w-full mx-auto animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
