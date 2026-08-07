// ─────────────────────────────────────────────────────────────
// MANEXA color tokens — the single documented source of truth.
//
// The RUNTIME color system is CSS variables (RGB channels) defined in
// src/app/globals.css: `:root` = dark (default), `:root.light` = light. They
// are wired to Tailwind so `bg-surface`, `text-accent`, `border-border`,
// `bg-success/12` etc. work with opacity utilities. Components should keep
// using those semantic Tailwind classes.
//
// This module documents those semantic tokens and exposes them as `rgb(var())`
// strings for the few places that need an inline value (canvas, charts, SVG
// gradients), plus the fixed brand + data-viz hex. It does NOT introduce a
// second palette — every semantic entry maps to the same CSS variable.
// ─────────────────────────────────────────────────────────────

/** A semantic token → its CSS variable name (theme-aware at runtime). */
export const cssVar = {
  bg: "--bg",
  surface: "--surface",
  elevated: "--elevated",
  card: "--card",
  border: "--border",
  fg: "--fg",
  muted: "--muted",
  subtle: "--subtle",
  accent: "--accent",
  accentFg: "--accent-fg",
  mint: "--mint",
  success: "--success",
  warning: "--warning",
  error: "--error",
  info: "--info",
} as const;

export type ColorToken = keyof typeof cssVar;

/** `rgb(var(--token))` — theme-aware. `color("accent", 0.12)` → tinted. */
export function color(token: ColorToken, alpha?: number): string {
  const v = `var(${cssVar[token]})`;
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
}

/** The Tailwind semantic class families that consume these tokens. Use these
 *  in components — never a raw hex or a Tailwind palette name like `slate-800`. */
export const semanticClass = {
  surface: "bg-bg bg-surface bg-elevated bg-card",
  text: "text-fg text-muted text-subtle text-accent",
  border: "border-border",
  status: "success warning error info", // tinted, e.g. bg-success/12 text-success border-success/30
} as const;

/**
 * Fixed brand + status hex — the immutable brand identity, and the only place
 * literal colors are allowed (gradients, data-viz, external widgets like the
 * Razorpay checkout theme). Do NOT hardcode these in components; import them.
 */
export const brand = {
  primary: "#B6FF2A", // neon green — the ONE accent
  secondary: "#00FF9C", // mint
  primaryGradient: "linear-gradient(135deg, #B6FF2A 0%, #00FF9C 100%)",
  darkBg: "#020617",
} as const;

/** Chart / data-visualization categorical palette (charts need literal colors).
 *  Brand-led, then a balanced supporting set. Keep ≤ this many series legible. */
export const chartPalette = [
  "#B6FF2A", // brand
  "#00FF9C", // mint
  "#22C55E", // success green
  "#3B82F6", // info blue
  "#8B5CF6", // purple
  "#F59E0B", // warning amber
  "#EC4899", // pink
  "#14B8A6", // teal
  "#FB923C", // orange
  "#06B6D4", // cyan
] as const;

/** Status → semantic token, for programmatic tone selection. */
export const statusTone: Record<"success" | "warning" | "danger" | "info" | "neutral", ColorToken> = {
  success: "success",
  warning: "warning",
  danger: "error",
  info: "info",
  neutral: "muted",
};
