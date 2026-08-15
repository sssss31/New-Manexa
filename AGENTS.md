# MANEXA — project notes for Codex

Multi-tenant, AI-powered School & Institution Management SaaS. Thousands of
institutions self-register and run fully isolated on one platform. Runnable
Next.js monolith; premium, dep-lean design system.

## Stack & run
- **Next.js 15 (App Router, RSC-first) · React 19 · TypeScript · Tailwind 3 · Prisma + PostgreSQL (Supabase/managed) · zod · framer-motion.**
- `npm run setup` (generate + migrate deploy + seed) then `npm run dev`. `docker compose up --build` for the full local stack. Reset data: `npm run db:reset`.
- Env validated at boot by `src/lib/env.ts`. Secrets in `.env` (Prisma + Next read it); `.env.local` is Next-only.

## Architecture
- **Business logic lives in `src/lib/`** (service-shaped, never in route files): `engine.ts`, `tenancy.ts` (create/join institution + `MAN-XXX-######` IDs), `permissions.ts` (DB-driven RBAC `can()`), `matching.ts`, `automation.ts`, `auth.ts`, `audit.ts`, `notify.ts`, `face/*`.
- **Routes** under `src/app/{admin,institution,teacher,accounts,parent,student}/`: each has `layout.tsx` (calls `requireRole`), pages, and `actions.ts` (`"use server"`).
- **Tenancy**: `institutionId` + `tenantId` on records; every query scoped by owner/tenant. Never cross tenants.

## Design system — READ `.Codex/` BEFORE building any UI
The full, binding design rules live in **`.Codex/`**: `design-system.md`,
`branding.md`, `component-rules.md`, `dashboard-rules.md`, `motion-guidelines.md`,
`ux-guidelines.md`, `accessibility.md`. Every new screen must follow them.

### The non-negotiables (summary)
- **Dark-first, neon-on-black.** Palette is CSS variables in `src/app/globals.css`
  (`:root` dark, `:root.light` light), wired to Tailwind as `rgb(var(--x) / <alpha>)`.
- **Always use semantic classes/tokens** — `bg-bg`/`bg-surface`/`bg-card`/`bg-elevated`,
  `border-border`, `text-fg`/`text-muted`/`text-subtle`, `text-accent`, and
  `success`/`warning`/`error`. **NEVER hardcode** hex, `navy`, `slate`, `bg-white`,
  `emerald`, etc. — it breaks theming. Typed tokens in `src/lib/design-system/`.
- **Brand green (`accent`, `#B6FF2A`) is an accent only** — one green moment per view
  (the single `btn-primary` CTA, an active state, a progress fill). Everything else
  is `btn-secondary`/`btn-ghost`. The logo mark uses `#BED740` (its own asset value).
- **Type**: Sora (headings, `font-display`) · Inter (body) · IBM Plex Mono (numbers,
  `tabular-nums`). **Radius** 16px cards / 12px controls. **8px spacing** system.
  **Soft, colorless shadows** only; the one neon glow is the primary-CTA hover.
- **Motion**: use the shared variants in `src/components/animations/` (Framer) or the
  CSS keyframes (`animate-fade-up`, `animate-pop`) — never ad-hoc transitions.
- **Reference bar**: Linear · Stripe · Notion · Vercel · Apple. Never a "school ERP" look.

## Component layers
- Primitives: `src/components/ui.tsx` (`Button` via cva, `Stat`, `Tag`, `StatusBadge`,
  `PageHeader`, `SectionCard`, `EmptyState`, `ProgressBar`) + `ui/` (client primitives:
  `QRCode`, `Avatar`). `cn()` from `@/lib/utils` for class merging.
- Shells/infra: `AppShell`, `Logo` (theme-aware, real brand SVG), `CommandK` (⌘K),
  `DataTable` (sort/filter/export/bulk), `Charts` (SVG), `Skeleton`, `Providers`
  (React Query + sonner toasts). Domain folders: `dashboard/`, `charts/`, `forms/`,
  `layout/`, `navigation/`, `feedback/`, `animations/`.
- Toasts: `notify.success/error/info` from `@/hooks`. Shortcuts: `useShortcut`.

## Conventions
- Money = **INR integers**; format with `inr()`. Every security/money action calls `audit()`.
- Client state minimal (RSC-first); use `zustand` only when genuinely needed, `@tanstack/react-query` for client fetching.
- External services (Razorpay, MSG91, Google Maps, GPS, ArcFace) are **simulated/pluggable** locally by design.

## Dev gotcha
NEVER run `next build` while the dev/preview server runs against the same `.next` — it
corrupts dev chunks. If it happens: stop server, `rm -rf .next`, restart.

## Golden path (main test flow)
Create Institution (self-serve → `MAN-XXX-######`) → admit students → AI matches/attendance
→ fees/invoices → exams/results → POD/settle. Verified via the preview browser.
