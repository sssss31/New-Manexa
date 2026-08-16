// Corner radii. Cards/panels use 16px (rounded-2xl); controls use 12px (xl).
export const radius = {
  none: "0",
  sm: "0.375rem", // 6
  md: "0.5rem", // 8
  lg: "0.75rem", // 12 — inputs, buttons
  xl: "1rem", // 16 — cards, panels (brand default)
  "2xl": "1.25rem", // 20
  full: "9999px",
} as const;

export type RadiusKey = keyof typeof radius;
export const CARD_RADIUS = radius.xl; // 16px — the MANEXA card standard
