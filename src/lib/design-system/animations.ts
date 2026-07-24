// Motion primitives shared by CSS keyframes (globals.css) and Framer Motion
// variants (components/animations). One vocabulary → consistent feel everywhere.

export const duration = {
  instant: 0.1,
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
  slower: 0.4,
} as const;

// Easing curves (cubic-bezier tuples for Framer; string forms for CSS).
export const easing = {
  standard: [0.21, 1, 0.36, 1], // premium "out-expo-ish" — the MANEXA default
  entrance: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  spring: { type: "spring", duration: 0.4, bounce: 0.15 },
} as const;

export const easingCss = {
  standard: "cubic-bezier(0.21, 1, 0.36, 1)",
  entrance: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

// Distances for slide/offset animations (px).
export const motionOffset = { sm: 6, md: 12, lg: 24 } as const;
