import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Premium analytics metric card: label, big value, optional delta trend and a
// slot for an inline sparkline/chart. The one card the whole dashboard reuses.
export function MetricCard({
  label,
  value,
  sub,
  delta,
  icon,
  chart,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { value: number; suffix?: string }; // positive = up (accent), negative = warning
  icon?: ReactNode;
  chart?: ReactNode; // e.g. <AreaChart .../>
  tone?: "default" | "accent" | "success" | "warning" | "error";
  className?: string;
}) {
  const toneCls =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "error"
      ? "text-error"
      : "text-fg";
  const up = (delta?.value ?? 0) >= 0;

  return (
    <div className={cn("card p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted font-medium">{label}</span>
        {icon && <span className="text-muted inline-flex items-center [&>svg]:w-[20px] [&>svg]:h-[20px]">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className={cn("text-2xl font-semibold tabular-nums", toneCls)}>{value}</div>
        {delta && (
          <span
            className={cn(
              "text-xs font-mono px-1.5 py-0.5 rounded-md",
              up ? "text-success bg-success/10" : "text-warning bg-warning/10"
            )}
          >
            {up ? "▲" : "▼"} {Math.abs(delta.value)}
            {delta.suffix ?? "%"}
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
      {chart && <div className="mt-1 -mx-1">{chart}</div>}
    </div>
  );
}
