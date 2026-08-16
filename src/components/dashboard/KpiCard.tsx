"use client";

// Premium KPI card — glass, tinted icon chip, optional delta trend, hover lift.
// Readability first: the value is the hero, glow is minimal.
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  default: "text-fg",
};

export function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
  delta,
  accentBar = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "accent" | "success" | "warning" | "error" | "default";
  delta?: { value: number; suffix?: string };
  accentBar?: boolean;
}) {
  const up = (delta?.value ?? 0) >= 0;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
      className="glass-card glass-card-hover p-4 overflow-hidden"
    >
      {accentBar && <span className="absolute top-0 left-0 h-full w-[3px] bg-accent/70 rounded-l-[18px]" />}
      <div className="flex items-start justify-between">
        <span className="icon-chip">{icon}</span>
        {delta && (
          <span
            className={cn(
              "text-[11px] font-mono px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5",
              up ? "text-success bg-success/10" : "text-warning bg-warning/10"
            )}
          >
            {up ? "▲" : "▼"} {Math.abs(delta.value)}
            {delta.suffix ?? "%"}
          </span>
        )}
      </div>
      <div className={cn("mt-3 text-2xl font-semibold tabular-nums tracking-tight", TONE[tone])}>{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-muted font-medium">{label}</div>
      {sub && <div className="mt-1 text-xs text-subtle">{sub}</div>}
    </motion.div>
  );
}
