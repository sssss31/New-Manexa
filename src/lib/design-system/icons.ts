// ─────────────────────────────────────────────────────────────────────────
// Icon sizing tokens — the SINGLE source of truth for icon scale.
//
// Icons must never look lost inside their container, and never be enlarged
// blindly: size follows the container's role in the hierarchy. Import these
// instead of hardcoding pixel sizes so the whole app scales consistently and
// can be retuned in one place.
//
//   token     px   where
//   ─────    ───   ─────────────────────────────────────────────────────────
//   xs        14   dense inline meta, tiny pills, table micro-affordances
//   sm        16   compact inline text pairing, small table cells
//   base      18   standard buttons, list rows, header/action icons
//   nav       19   sidebar / primary navigation
//   action    20   icon-only buttons (inside 40–44px targets), prominent CTAs
//   card      22   stat / KPI / card widgets
//   lg        26   large feature cards
//   xl        30   hero / marketing feature
// ─────────────────────────────────────────────────────────────────────────

export const iconSize = {
  xs: 14,
  sm: 16,
  base: 18,
  nav: 19,
  action: 20,
  card: 22,
  lg: 26,
  xl: 30,
} as const;

export type IconSizeToken = keyof typeof iconSize;

/** Resolve a token (or a raw px number) to pixels. */
export function iconPx(size: IconSizeToken | number = "base"): number {
  return typeof size === "number" ? size : iconSize[size];
}
