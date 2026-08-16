// Elevation / shadow scale. On the dark theme shadows are subtle; depth comes
// mostly from the surface ramp (bg → surface → elevated → card) + borders.
// `glass`/`floating`/`premium` include the brand-tinted glow used on hero CTAs.
export const shadow = {
  xs: "0 1px 2px rgb(0 0 0 / 0.20)",
  sm: "0 2px 6px -1px rgb(0 0 0 / 0.25)",
  md: "0 6px 16px -4px rgb(0 0 0 / 0.30)",
  lg: "0 12px 32px -8px rgb(0 0 0 / 0.40)",
  xl: "0 24px 60px -12px rgb(0 0 0 / 0.50)",
  "2xl": "0 40px 90px -20px rgb(0 0 0 / 0.60)",
  glass: "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 8px 30px -12px rgb(0 0 0 / 0.5)",
  floating: "0 20px 50px -12px rgb(0 0 0 / 0.55)",
  hover: "0 14px 40px -10px rgb(0 0 0 / 0.5)",
  premium: "0 0 0 1px rgb(0 255 156 / 0.45), 0 16px 44px -10px rgb(182 255 42 / 0.55)",
} as const;
export type ShadowToken = keyof typeof shadow;

/** Surface elevation ladder — the primary depth cue on dark theme. */
export const surfaceLevel = ["bg", "surface", "elevated", "card"] as const;
