# MANEXA — UX Guidelines

## Every page includes
Empty state · error state (`error.tsx`) · loading state (`loading.tsx` skeletons) ·
success feedback (toast) · confirmation for destructive/irreversible actions ·
quick search where lists are long · the global command palette (⌘K) · keyboard
navigation · notifications (bell) · profile menu · quick actions.

## Interaction principles
- **Fast & forgiving.** Optimistic where safe; always reversible destructive actions
  behind a confirm. Rate-limited sensitive actions.
- **Progressive disclosure.** Lead with the decision-relevant metric; details on demand.
- **One primary action per view** (the single accent CTA). Secondary actions neutral.
- **Feedback within 100ms** — hover/press states, skeletons on load, toast on completion.
- **Consistent wayfinding** — sidebar sections, active state on the current route,
  breadcrumbs on deep pages.

## Content & tone
- Precise, plain, confident. No jargon-y ERP language. Number-first for metrics.
- Money always `inr()`; dates via `dateShort`/`relative`; IDs in `font-mono`.

## Multi-tenant UX
- Institution context (name + `MAN-XXX-######`) is always visible in the shell.
- Never leak cross-tenant data; scope every list by tenant. Pending-approval users
  see a clear "awaiting approval" state, not an error.

## Responsive
Desktop → laptop → tablet → mobile. Sidebar collapses; grids reflow
(`grid-cols-2 md:grid-cols-4`); tables scroll inside `table-wrap`; the body never
scrolls horizontally. Touch targets ≥ 40px.
