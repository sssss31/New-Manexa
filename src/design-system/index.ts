// MANEXA Design System — public surface.
//
//   import { color, spacing, radius, shadow, fadeUp, zIndex } from "@/design-system";
//
// Tokens are the single documented source of truth; the runtime styling is the
// CSS-variable + Tailwind system in globals.css (see README.md). Components live
// in src/components and consume the Tailwind semantic classes + these tokens.

export * from "./tokens/colors";
export * from "./tokens/spacing";
export * from "./tokens/radius";
export * from "./tokens/typography";
export * from "./tokens/elevation";
export * from "./tokens/motion";
export * from "./tokens/layout";

// Re-export the class-name util so components import everything design-related
// from one place.
export { cn } from "@/lib/utils";
