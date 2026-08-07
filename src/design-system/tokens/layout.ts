// Breakpoints, z-index, opacity and blur tokens. Breakpoints match Tailwind's
// defaults so `md:`/`lg:` utilities stay in sync. z-index is a named ladder so
// overlays never fight — always use these instead of magic numbers.

export const breakpoints = {
  sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536,
} as const;
export type Breakpoint = keyof typeof breakpoints;

/** Named stacking order. Higher = closer to the viewer. */
export const zIndex = {
  base: 0,
  raised: 10,     // sticky headers, aurora canvas sits at -1 behind content
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,  // dialog/drawer backdrop
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
  commandPalette: 1700,
} as const;
export type ZToken = keyof typeof zIndex;

export const opacity = {
  0: 0, 4: 0.04, 8: 0.08, 12: 0.12, 20: 0.2, 30: 0.3, 40: 0.4,
  60: 0.6, 70: 0.7, 80: 0.8, 90: 0.9, 100: 1,
} as const;

export const blur = {
  none: 0, sm: 4, md: 8, lg: 16, xl: 24, glass: 20,
} as const;
