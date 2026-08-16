import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Theming is variable-driven, not variant-driven: `:root` is dark by default
  // and `:root.light` overrides the tokens (see globals.css / ThemeToggle), so
  // every color comes from `rgb(var(--x))`. We deliberately use NO `dark:`
  // utilities — this setting only exists to stop `dark:` (if ever added) from
  // silently keying off the OS `prefers-color-scheme` media query.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--accent-fg) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      // 8px spacing system — extra rungs on top of Tailwind's default scale.
      spacing: {
        18: "4.5rem", // 72
        22: "5.5rem", // 88
      },
      maxWidth: {
        content: "1400px", // main column
        reading: "768px", // prose / auth panels
      },
      screens: {
        xs: "480px",
      },
      boxShadow: {
        glow: "0 0 24px -6px rgb(var(--accent) / 0.55)",
        soft: "0 6px 20px -6px rgb(0 0 0 / 0.40)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.21, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s cubic-bezier(0.21, 1, 0.36, 1) both",
        pop: "pop 0.18s cubic-bezier(0.21, 1, 0.36, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
