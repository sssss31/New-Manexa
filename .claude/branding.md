# MANEXA — Branding

## Colors (the ONLY palette)
Defined as CSS variables (RGB channels) in `src/app/globals.css` — `:root` is dark
(default), `:root.light` is light. Wired to Tailwind as `rgb(var(--x) / <alpha>)`.

| Token | Dark | Role |
|---|---|---|
| `--bg` | #000000 | app background |
| `--surface` | #111111 | sidebar, panels |
| `--elevated` | #1E1E1E | inputs, hovers |
| `--card` | #181818 | cards |
| `--border` | #2A2A2A | hairlines |
| `--fg` | #FFFFFF | primary text |
| `--muted` | #BDBDBD | secondary text |
| `--subtle` | #7A7A7A | tertiary |
| `--accent` | **#B6FF2A** | neon green — accent only |
| `--accent-fg` | #000000 | text/icon on an accent fill |
| `--mint` | #00FF9C | secondary accent — aurora orbs & the wordmark gradient tail only, never a second CTA |
| `--success` | #49FF78 | · `--warning` #FFC107 · `--error` #FF5252 · `--info` #BDBDBD (neutral) |

**Rules**
- Use semantic classes/tokens only. NEVER hardcode `#hex`, `navy`, `slate`, `white`,
  `emerald`, `bg-white`, etc. Status tints: `bg-success/12 text-success border-success/30`.
- **Accent discipline:** one green moment per view — the single primary CTA, an active
  nav item, or a progress fill. Everything else is neutral (`btn-secondary`/`ghost`).
- No colorful shadows. No unnecessary gradients. No childish/ERP look.

## Logo
- Component: `src/components/Logo.tsx` (theme-aware inline SVG). Mark green `#BED740`
  (the asset's exact value); wordmark uses `rgb(var(--fg))` so it flips for contrast
  (white on dark, near-black on light).
- Assets: `public/manexa-logo-dark.svg` (white wordmark), `public/manexa-logo-light.svg`
  (black wordmark), `public/manexa-mark.svg` (glyph only). Favicon: `src/app/icon.svg`.
- `<Logo />` full lockup · `<Logo showWord={false} />` mark only.

## Typography
Headings **Sora** (`font-display`), body **Inter** (`font-sans`), numbers **IBM Plex
Mono** (`font-mono` / `tabular-nums`). Headings use `tracking-tight` (-0.02em). Eyebrow
labels: `text-xs uppercase tracking-wider text-muted`.
