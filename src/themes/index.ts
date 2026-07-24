// Theme tokens are CSS variables in app/globals.css (:root dark, :root.light).
// Typed accessors live in lib/design-system. This barrel re-exports them.
export * from "@/lib/design-system";
export const THEME_STORAGE_KEY = "mnx-theme";
export type ThemeName = "dark" | "light";
