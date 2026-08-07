// Typography scale. Fonts are loaded in src/app/layout.tsx (next/font) and
// exposed as CSS vars: --font-inter (body), --font-sora (display/hero),
// --font-mono (IBM Plex Mono, code/numbers). Use the Tailwind size utilities
// in markup; this scale documents the intent + values for consistency.

export const fontFamily = {
  sans: "var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif",
  display: "var(--font-sora), var(--font-inter), sans-serif",
  mono: "var(--font-mono), ui-monospace, monospace",
} as const;

export const fontWeight = {
  regular: 400, medium: 500, semibold: 600, bold: 700,
} as const;

/** name → { size(px), lineHeight(px), weight, tracking(em), family } */
export const typeScale = {
  displayXl: { size: 60, line: 64, weight: 700, tracking: -0.02, family: "display" },
  displayLg: { size: 48, line: 52, weight: 700, tracking: -0.02, family: "display" },
  displayMd: { size: 36, line: 42, weight: 600, tracking: -0.02, family: "display" },
  headingXl: { size: 30, line: 36, weight: 600, tracking: -0.01, family: "display" },
  headingLg: { size: 24, line: 30, weight: 600, tracking: -0.01, family: "sans" },
  headingMd: { size: 20, line: 26, weight: 600, tracking: 0, family: "sans" },
  headingSm: { size: 18, line: 24, weight: 600, tracking: 0, family: "sans" },
  title: { size: 16, line: 22, weight: 600, tracking: 0, family: "sans" },
  subtitle: { size: 15, line: 22, weight: 500, tracking: 0, family: "sans" },
  bodyLg: { size: 16, line: 24, weight: 400, tracking: 0, family: "sans" },
  body: { size: 14, line: 21, weight: 400, tracking: 0, family: "sans" },
  bodySm: { size: 13, line: 19, weight: 400, tracking: 0, family: "sans" },
  caption: { size: 12, line: 16, weight: 400, tracking: 0, family: "sans" },
  label: { size: 11, line: 14, weight: 500, tracking: 0.06, family: "sans" }, // uppercase eyebrow
  button: { size: 14, line: 20, weight: 600, tracking: 0, family: "sans" },
  code: { size: 13, line: 20, weight: 400, tracking: 0, family: "mono" },
} as const;
export type TypeToken = keyof typeof typeScale;
