// Structural layout constants — the app shell dimensions and content widths.
export const layout = {
  sidebarWidth: 256, // w-64
  sidebarCollapsedWidth: 68,
  headerHeight: 56, // h-14
  contentMaxWidth: 1400, // max-w-[1400px] main column
  readingMaxWidth: 768, // prose / auth panels
} as const;

// Responsive breakpoints (px) — mirror tailwind.config screens.
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

// Named container sizes for centered content blocks.
export const container = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  full: "100%",
} as const;

export type Breakpoint = keyof typeof breakpoints;
