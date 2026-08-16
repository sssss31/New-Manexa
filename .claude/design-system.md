# MANEXA — Design System

Reference bar: **Linear · Stripe · Notion · Vercel · Apple**. Everything must feel
premium, minimal, fast, enterprise.

## Tokens
- Colors → `.claude/branding.md`. Typed accessors: `src/lib/design-system/`
  (`colors.ts`, `spacing.ts`, `radius.ts`, `typography.ts`, `shadows.ts`,
  `animations.ts`, `z-index.ts`, `layout.ts`). Import via `@/lib/design-system`.
- **Spacing**: 8px system (base unit 8; 4px half-steps). Every gap/pad is a multiple.
- **Radius**: cards/panels 16px (`rounded-2xl`), controls 12px (`rounded-xl`), pills full.
- **Shadows**: soft & colorless (`shadow-soft`); the only glow is `shadow-glow` on the
  primary CTA hover.
- **Z-index**: use the `zIndex` scale (`sticky` 20 → `header` 30 → `modal` 60 → `toast` 80).
- **Containers**: main column `max-w-content` (1400px); reading/auth `max-w-reading` (768px).

## Shared CSS classes (globals.css)
`card` · `panel` · `elevated` · `btn-primary|secondary|ghost|danger` ·
`input`/`select`/`textarea` · `label` · `badge` + `badge-{success|warning|error|info|muted|accent}` ·
`stat`/`stat-label`/`stat-value` · `th`/`td`/`row-hover` · `nav-link` · `table-wrap`
(sticky header) · `animate-fade-up`/`animate-pop`/`skeleton`.

## Building a screen (checklist)
1. `PageHeader` (title + sub + actions) at top.
2. Stat/metric row → `MetricCard` or `Stat` (grid `grid-cols-2 md:grid-cols-4 gap-3`).
3. Visual analytics before tables — charts from `@/components/charts` (never "plain numbers").
4. Content in `SectionCard`s; long lists in `DataTable`; heavy lists virtualized.
5. Empty / loading / error states always present (`EmptyState`, `loading.tsx`, `error.tsx`).
6. One accent moment. Neutral everything else.
7. Responsive: desktop → laptop → tablet → mobile. Tables scroll inside `table-wrap`;
   the page body never scrolls horizontally.

## Do / Don't
- ✅ semantic tokens, `cn()` for class merges, cva for variants, shared motion variants.
- ❌ hardcoded colors, ad-hoc transitions, new chart/table/palette libs (we have them),
  more than one green per view, dense/cramped layouts.
