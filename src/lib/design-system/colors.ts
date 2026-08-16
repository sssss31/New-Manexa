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
  | "mint"
  | "success"
  | "warning"
  | "error"
  | "info";

// The brand green as a literal — for the logo mark / favicon only, where the
// value must be embedded. Everything themeable uses `token("accent")`.
export const BRAND_GREEN = "#B6FF2A";
export const BRAND_GREEN_LOGO = "#BED740"; // exact value in the supplied logo asset
export const BRAND_SUCCESS = "#49FF78";
export const BRAND_BORDER = "#2A2A2A";
export const BRAND_SURFACE = "#111111";

/**
 * Literal brand ramp for third-party renderers that cannot read CSS variables
 * (e.g. `boring-avatars`, canvas, QR codes). Mirrors the dark-theme tokens —
 * keep in sync with `:root` in globals.css and `.claude/branding.md`.
 */
export const BRAND_RAMP = [
  BRAND_GREEN,
  BRAND_SUCCESS,
  BRAND_GREEN_LOGO,
  BRAND_BORDER,
  BRAND_SURFACE,
] as const;

/**
 * Dark-theme tokens as literal hex, for the two places that render outside
 * globals.css and therefore cannot resolve CSS variables:
 *   - `app/global-error.tsx` (renders its own <html>/<body>)
 *   - `lib/comms.ts` (transactional email; clients strip <style> and vars)
 * Nothing else may use these — themed UI uses semantic Tailwind classes.
 */
export const BRAND_DARK = {
  bg: "#000000",
  surface: BRAND_SURFACE,
  card: "#181818",
  border: BRAND_BORDER,
  fg: "#FFFFFF",
  muted: "#BDBDBD",
  subtle: "#7A7A7A",
  accent: BRAND_GREEN,
  accentFg: "#000000",
} as const;

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
  mint: token("mint"),
  success: token("success"),
  warning: token("warning"),
  error: token("error"),
  info: token("info"),
} as const;
