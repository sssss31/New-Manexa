// Soft, colorless shadows only (per brand: "no colorful shadows"). Depth comes
// from elevation + border, not heavy drop shadows.
export const shadows = {
  none: "none",
  xs: "0 1px 2px rgb(0 0 0 / 0.20)",
  sm: "0 2px 8px -2px rgb(0 0 0 / 0.30)",
  md: "0 6px 20px -6px rgb(0 0 0 / 0.40)",
  lg: "0 16px 40px -12px rgb(0 0 0 / 0.55)",
  // The single neon "glow" — reserved for the primary CTA hover, nothing else.
  glow: "0 0 24px -6px rgb(var(--accent) / 0.55)",
} as const;

export type ShadowKey = keyof typeof shadows;
