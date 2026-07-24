# MANEXA — Accessibility (WCAG 2.1 AA target)

Accessibility is part of "done", not a later pass.

## Requirements
- **Semantic HTML**: real `<button>`, `<a>`, `<nav>`, `<main>`, `<table>`, `<label>`.
  No `div` buttons. One `<h1>` per page; ordered headings.
- **Keyboard**: everything operable without a mouse. Command palette (⌘K), focus
  order logical, `Esc` closes overlays, arrow-key nav in the palette. Skip-to-content
  link (`.sr-skip`) at the top of every shell.
- **Focus rings**: visible neon ring via `:focus-visible` (globals.css). Never remove
  outlines without a replacement.
- **ARIA**: label icon-only buttons (`aria-label`), `aria-current="page"` on active nav,
  `role="dialog"`/`aria-modal` on modals, `aria-sort` on sortable table headers,
  `aria-busy` on loading regions, `role="img"`+`aria-label` on chart/logo SVGs.
- **Contrast**: text ≥ 4.5:1. Note the light theme uses a **darkened accent** for
  contrast on white (`:root.light --accent`) — never put white text on neon, or neon
  text on white, without checking.
- **Screen readers**: meaningful alt text; decorative elements `aria-hidden`; announce
  async results (toasts are polite live regions via sonner).
- **Reduced motion**: `prefers-reduced-motion` disables animation (globals.css + Framer).
  Never hide essential content behind motion.
- **Forms**: every control has a `<label>`; errors linked and announced; required state
  conveyed by more than color.

## Quick check before shipping a screen
Tab through it · Esc closes overlays · zoom 200% still usable · colors pass contrast ·
icon-only controls have labels · images/SVGs labelled or hidden.
