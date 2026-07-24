"use client";

// Deterministic avatar. Uses initials on the accent tint by default; falls back
// to a generated boring-avatar when `variant="art"`.
import BoringAvatar from "boring-avatars";
import { cn } from "@/lib/utils";

const PALETTE = ["#B6FF2A", "#49FF78", "#BED740", "#2A2A2A", "#111111"];

export function Avatar({
  name,
  size = 36,
  variant = "initials",
  className,
}: {
  name: string;
  size?: number;
  variant?: "initials" | "art";
  className?: string;
}) {
  if (variant === "art") {
    return (
      <span className={cn("inline-block overflow-hidden rounded-full", className)}>
        <BoringAvatar size={size} name={name} variant="beam" colors={PALETTE} />
      </span>
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent/15 text-accent font-semibold shrink-0",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
