// Layering scale. Keep every fixed/absolute overlay on one of these rungs so
// stacking is predictable across the app.
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20, // sticky table headers, sub-navs
  header: 30, // app top bar
  dropdown: 40,
  overlay: 50, // scrims / backdrops
  modal: 60, // dialogs, command palette
  popover: 70, // tooltips over modals
  toast: 80, // sonner notifications
  max: 9999,
} as const;

export type ZIndexKey = keyof typeof zIndex;
