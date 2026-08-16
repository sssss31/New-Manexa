# MANEXA — Motion Guidelines

Feel: **Apple-smooth, Linear-fast.** Motion clarifies, never decorates.

## One vocabulary
Primitives in `src/lib/design-system/animations.ts` (durations, easings). Framer
variants in `src/components/animations/variants.ts`; wrappers in `Motion.tsx`. CSS
keyframes for zero-JS surfaces (`animate-fade-up`, `animate-pop`, `skeleton`).

- **Default easing**: `cubic-bezier(0.21, 1, 0.36, 1)` (premium out-expo). Springs for
  modals/pop.
- **Durations**: fast 0.15s (hover/tap), base 0.2s, slow 0.28s (enter), 0.4s (drawer).

## Use the wrappers, not ad-hoc transitions
`<Fade>` · `<FadeUp>` · `<SlideIn>` · `<Scale>` · `<Stagger>` (list cascade) ·
`<Interactive>` (hover-lift + tap-press) · `<PageTransition>`. Modals/drawers use the
`modal`/`drawer`/`backdrop` variants. Toasts come from `sonner`.

## Where motion belongs
- Page/route mount → `fadeUp`.
- Cards/rows entering a list → `Stagger` + `fadeUp` children.
- Command palette / modal → `scaleIn`/`modal` + `backdrop`.
- Buttons/cards → hover lift (-2px) + tap press (0.98). Active states animate color.
- Sidebar collapse, drawer, notification toast → the shared drawer/toast variants.

## Restraint
- No gratuitous parallax, bounce, or long durations. Nothing over ~0.4s.
- **Respect `prefers-reduced-motion`** — globals.css nukes durations to ~0; Framer honors
  it too. Never gate essential info behind motion.
