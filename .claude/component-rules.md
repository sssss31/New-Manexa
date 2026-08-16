# MANEXA — Component Rules

## Where things live
- **Primitives**: `src/components/ui.tsx` (server-safe: `Button` via cva, `Stat`,
  `Tag`, `StatusBadge`, `PageHeader`, `SectionCard`, `EmptyState`, `ProgressBar`).
  Client primitives in `src/components/ui/` (`QRCode`, `Avatar`).
- **Domain folders**: `dashboard/` (MetricCard…), `charts/`, `forms/` (Field, TextInput),
  `layout/` (AppShell), `navigation/` (CommandK), `feedback/` (EmptyState, Skeleton),
  `animations/` (Motion + variants).
- Note: `@/components/ui` resolves to the `ui.tsx` file; client primitives are imported
  by full path (`@/components/ui/QRCode`).

## Rules
1. **Reuse before creating.** We already have palette (`CommandK`), table (`DataTable`),
   charts (`Charts`), skeletons (`Skeleton`), theme system, toasts (`sonner` via `notify`).
   Do NOT add cmdk/recharts/@tanstack/react-table/next-themes/react-loading-skeleton —
   they duplicate these.
2. **Variants via cva** (`class-variance-authority`) composing the brand `.btn-*`/token
   classes; merge with `cn()`. No inline style objects for themeable color.
3. **Server-first.** Default to Server Components. Add `"use client"` only for
   interactivity (state, effects, camera, DnD, form libs). Keep primitives server-safe
   unless they must be client.
4. **Props over globals.** Components take data via props; no direct Prisma in components.
5. **Every list/table/card ships its empty, loading, and error states.**
6. **Icons**: `lucide-react` (preferred) or the local `Icons.tsx`. White by default;
   active = accent.
7. **Accessibility is part of "done"** — see `.claude/accessibility.md`.

## Forms
`react-hook-form` + `zod` (`@hookform/resolvers`) on the client; the `Field`/`TextInput`
wrappers in `components/forms`. Server mutations still go through `actions.ts`
(`"use server"`) → `lib/*`. Show inline validation, loading, and success (toast) states.
