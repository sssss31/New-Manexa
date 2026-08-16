// Type system. Families come from next/font CSS variables set in layout.tsx.
// Headings: Sora · Body: Inter · Numbers/mono: IBM Plex Mono.
export const fontFamily = {
  display: "var(--font-sora)", // headings
  sans: "var(--font-inter)", // body
  mono: "var(--font-mono)", // numbers, code, IDs
} as const;

// Modular scale (rem). Prefer Tailwind text-* utilities in JSX.
export const fontSize = {
  xs: "0.75rem", // 12
  sm: "0.875rem", // 14
  base: "1rem", // 16
  lg: "1.125rem", // 18
  xl: "1.25rem", // 20
  "2xl": "1.5rem", // 24
  "3xl": "1.875rem", // 30
  "4xl": "2.25rem", // 36
  "5xl": "3rem", // 48
  "6xl": "3.75rem", // 60
} as const;

export const fontWeight = { normal: 400, medium: 500, semibold: 600, bold: 700 } as const;

export const letterSpacing = {
  tight: "-0.02em", // headings
  normal: "0",
  wide: "0.05em",
  widest: "0.2em", // eyebrow labels
} as const;

export const lineHeight = { none: 1, tight: 1.15, snug: 1.35, normal: 1.5, relaxed: 1.65 } as const;
