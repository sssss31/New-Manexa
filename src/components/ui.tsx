import Link from "next/link";
import { ReactNode, forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Canonical Button — composes the brand `.btn-*` classes via cva so every
// button shares one variant API. Server-safe (no client hooks).
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
    size: {
      sm: "text-xs px-2.5 py-1.5",
      md: "",
      lg: "text-base px-5 py-2.5",
      icon: "w-9 h-9 p-0",
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "accent";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "error"
      ? "text-error"
      : tone === "accent"
      ? "text-accent"
      : "text-fg";
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneCls}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const good = ["ACTIVE", "PAID", "PRESENT", "PUBLISHED", "APPROVED", "DELIVERED", "OK", "CONFIRMED", "SENT", "DISBURSED", "EVALUATED"];
  const warn = ["PENDING", "DRAFT", "SCHEDULED", "DUE", "LATE", "PARTIALLY_PAID", "PROVISIONING", "SUSPENDED", "CONTACTED", "VISIT_SCHEDULED"];
  const err = ["OVERDUE", "FAILED", "ABSENT", "LOST", "TERMINATING", "CANCELLED", "RETIRED", "VOIDED"];
  let cls = "badge-muted";
  if (good.includes(s)) cls = "badge-success";
  else if (warn.includes(s)) cls = "badge-warning";
  else if (err.includes(s)) cls = "badge-error";
  return <span className={`badge ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "success" | "info" | "warning" | "error" }) {
  const map = {
    muted: "badge-muted",
    accent: "badge-accent",
    success: "badge-success",
    info: "badge-info",
    warning: "badge-warning",
    error: "badge-error",
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-fg font-medium">{title}</div>
      {sub && <div className="text-sm text-muted mt-1">{sub}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          {title && <h2 className="section-h">{title}</h2>}
          {right && <div>{right}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ProgressBar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "success" | "warning" | "error" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const cls =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "error" ? "bg-error" : "bg-accent";
  return (
    <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
      <div className={`h-full ${cls} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function NavItem({ href, label, icon, active }: { href: string; label: string; icon?: ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={`nav-link ${active ? "active" : ""}`}>
      {icon && <span className="text-muted">{icon}</span>}
      <span>{label}</span>
    </Link>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">{k}</span>
      <span className="text-sm text-fg">{v}</span>
    </div>
  );
}
