// 8-point spacing scale (4px base). Every gap/pad/margin should come from here
// — these map 1:1 to Tailwind's default scale (space-4 = 16px, etc.), so use
// the Tailwind utilities in markup and this token for computed values.
export const spacing = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
  8: 32, 10: 40, 12: 48, 14: 56, 16: 64, 18: 72, 20: 80, 24: 96, 32: 128,
} as const;
export type SpaceToken = keyof typeof spacing;
export const space = (t: SpaceToken): string => `${spacing[t]}px`;

/** Content container widths used across the app. */
export const container = {
  form: 448, // max-w-md — auth / single-column forms
  content: 768, // reading width
  app: 1400, // main app content max-width (AppShell)
} as const;
