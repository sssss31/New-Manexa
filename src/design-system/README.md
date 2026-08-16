# MANEXA Design System

The single source of truth for MANEXA's visual language. Every screen consumes
it; no page hardcodes colors, spacing, or typography.

## How it's layered

1. **Runtime tokens — `src/app/globals.css`.** Colors are CSS variables (RGB
   channels): `:root` is dark (default), `:root.light` is light. Wired to
   Tailwind (`tailwind.config.ts`) as `rgb(var(--x) / <alpha>)`, so semantic
   utilities support opacity: `bg-surface`, `text-accent`, `border-border`,
   `bg-success/12 text-success border-success/30`. Theme persists in
   `localStorage['mnx-theme']`; a no-FOUC inline script applies it before paint.

2. **Documented tokens — `src/design-system/tokens/*.ts` (this folder).** Typed
   modules that mirror the runtime system and add the pieces CSS can't express
   ergonomically: the 8-pt spacing scale, radius, elevation/shadow, the type
   scale, motion presets, breakpoints, a named z-index ladder, opacity and blur.
   Import from the barrel: `import { color, fadeUp, zIndex, chartPalette } from "@/design-system"`.

3. **Components — `src/components/**`.** Consume the Tailwind semantic classes +
   these tokens. Shared primitives already exist and should be reused, not
   re-implemented:
   - `ui.tsx` — `Button` (CVA), `Stat`, `StatusBadge`, `Tag`, `EmptyState`,
     `PageHeader`, `SectionCard`, `ProgressBar`, `KV`, `NavItem`.
   - `AppShell.tsx`, `Logo.tsx`, `ThemeToggle.tsx`, `CommandK.tsx`, `Charts.tsx`.
   - `auth/` (AuthShell, AuthField, PasswordField, AuthSubmit, wizards),
     `dashboard/` (KpiCard, Panel), `billing/`, `import/`, `payments/`.
   - Brand CSS classes in `globals.css`: `card`, `panel`, `glass-card`,
     `glass-panel`, `btn-primary|secondary|ghost|danger`, `input`/`select`/
     `textarea`, `label`, `badge`, `stat*`, `th`/`td`, `row-hover`, `dot`,
     `auth-cta`, `auth-input`, `mkt-*` (marketing), `dash-orb` (aurora).

## Rules (enforced by convention + review)

- **Never** hardcode a hex or a Tailwind palette name (`slate-800`, `emerald`)
  in a component. Use a semantic class (`bg-card`, `text-muted`) or a token.
- The **only** literal colors allowed are in `tokens/colors.ts` (`brand`,
  `chartPalette`) — for gradients, charts, and external widgets (e.g. the
  Razorpay checkout theme).
- One accent moment per view: the single `btn-primary`/`auth-cta` CTA, an active
  nav state, or a progress fill. Brand green (`#B6FF2A`) is an accent, not a fill.
- Spacing from the 8-pt scale; radius/shadow/z-index from their tokens.
- Motion via the `motion.ts` presets; respect `prefers-reduced-motion`.

## Accessibility

- Semantic HTML + ARIA on interactive components; visible focus rings
  (`:focus` glow on `auth-input`, ring on buttons).
- Color pairs meet WCAG AA — the light theme darkens the accent for contrast.
- `prefers-reduced-motion` is honored in `globals.css` and `motion.reducedMotion()`.

## Not used, on purpose

**shadcn/ui and Radix are intentionally not adopted.** MANEXA already ships a
cohesive custom token + Tailwind + CVA system (chosen earlier over shadcn).
Introducing shadcn would create a second, duplicate styling source — exactly
what this system prevents. Radix primitives can be added later per-component if
a specific a11y need arises, styled with these tokens.
