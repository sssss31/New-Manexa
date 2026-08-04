import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "@/components/Logo";

// Unified premium auth chrome: aurora background + split brand / form layout.
// Every auth screen (sign-in, sign-up, forgot, verify, success) renders inside
// this so they share one design language. Brand tokens only.
export function AuthShell({
  children,
  brandExtra,
  eyebrow = "AI-Powered Education OS",
}: {
  children: ReactNode;
  brandExtra?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Aurora canvas */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="dash-orb dash-orb-green h-[560px] w-[560px] -left-40 -top-40" />
        <div className="dash-orb dash-orb-mint h-[460px] w-[460px] right-[-140px] top-1/4 opacity-[0.12]" />
        <div className="dash-orb dash-orb-navy h-[520px] w-[520px] bottom-[-160px] left-1/3" />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <aside className="hidden flex-col justify-between border-r border-border bg-surface/40 p-10 backdrop-blur-xl lg:flex">
          <Link href="/" aria-label="MANEXA home"><Logo /></Link>
          <div>
            <div className="mkt-chip mb-4 !text-xs"><span className="dot" /> {eyebrow}</div>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
              One platform.<br />Every module.<br />
              <span className="mkt-gradient-text">From lead to alumni.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted">
              MANEXA runs the institution while educators teach — admissions to alumni,
              in one AI-powered platform trusted by schools, colleges and academies.
            </p>
            {brandExtra}
          </div>
          <div className="text-xs text-muted">© MANEXA · Engineering the Future of Education</div>
        </aside>

        {/* Form panel */}
        <main className="flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden"><Link href="/" aria-label="MANEXA home"><Logo /></Link></div>
            <div className="glass-card rounded-2xl p-6 sm:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
