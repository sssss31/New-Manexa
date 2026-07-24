// MANEXA color tokens — the single source of truth is the CSS variables in
// globals.css (RGB channels, theme-aware). These helpers reference those tokens;
// NEVER hardcode a hex here. Use semantic Tailwind classes in JSX; use these
// only where a raw color string is unavoidable (SVG fills, canvas, inline gradients).

/** `rgb(var(--x))` for a token, with optional 0–1 alpha → `rgb(var(--x) / a)`. */
export function token(name: ColorToken, alpha?: number): string {
  return alpha === undefined ? `rgb(var(--${name}))` : `rgb(var(--${name}) / ${alpha})`;
}

export type ColorToken =
  | "bg"
  | "surface"
  | "elevated"
  | "card"
  | "border"
  | "fg"
  | "muted"
  | "subtle"
  | "accent"
  | "accent-fg"
  | "success"
  | "warning"
  | "error"
  | "info";

// The brand green as a literal — for the logo mark / favicon only, where the
// value must be embedded. Everything themeable uses `token("accent")`.
export const BRAND_GREEN = "#B6FF2A";
export const BRAND_GREEN_LOGO = "#BED740"; // exact value in the supplied logo asset

export const colors = {
  bg: token("bg"),
  surface: token("surface"),
  elevated: token("elevated"),
  card: token("card"),
  border: token("border"),
  fg: token("fg"),
  muted: token("muted"),
  subtle: token("subtle"),
  accent: token("accent"),
  accentFg: token("accent-fg"),
  success: token("success"),
  warning: token("warning"),
  error: token("error"),
  info: token("info"),
} as const;
