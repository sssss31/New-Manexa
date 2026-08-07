// Corner-radius scale. Matches the Tailwind rounded-* utilities the app uses;
// cards are rounded-2xl, inputs/buttons rounded-xl, pills rounded-full.
export const radius = {
  xs: 4,   // rounded
  sm: 6,   // rounded-md
  md: 8,   // rounded-lg
  lg: 12,  // rounded-xl — inputs, buttons
  xl: 16,  // rounded-2xl — cards, panels
  "2xl": 20,
  "3xl": 24,
  full: 9999, // pills, avatars
} as const;
export type RadiusToken = keyof typeof radius;
export const rounded = (t: RadiusToken): string => (t === "full" ? "9999px" : `${radius[t]}px`);
