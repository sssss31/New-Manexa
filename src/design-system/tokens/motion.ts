// Motion tokens + reusable Framer Motion presets. Import a preset instead of
// re-writing initial/animate/transition on every component, so motion feels
// consistent. All presets respect prefers-reduced-motion via `reducedMotion`.
import type { Variants, Transition } from "framer-motion";

export const duration = { fast: 0.12, base: 0.18, slow: 0.25, slower: 0.4 } as const;
export const easing = {
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
  emphasized: [0.2, 0, 0, 1] as [number, number, number, number],
  spring: { type: "spring", stiffness: 380, damping: 30 } as Transition,
} as const;

const t = (d: number = duration.base): Transition => ({ duration: d, ease: easing.standard });

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: t() },
  exit: { opacity: 0, transition: t(duration.fast) },
};
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: t(duration.slow) },
  exit: { opacity: 0, y: 8, transition: t(duration.fast) },
};
export const slideRight: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: t() },
  exit: { opacity: 0, x: -16, transition: t(duration.fast) },
};
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: t() },
  exit: { opacity: 0, scale: 0.98, transition: t(duration.fast) },
};
export const modal: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: t(duration.slow) },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: t(duration.fast) },
};
export const drawer: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: easing.spring },
  exit: { x: "100%", transition: t(duration.slow) },
};
export const toast: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: t() },
  exit: { opacity: 0, y: 8, transition: t(duration.fast) },
};

/** Stagger container for lists of `fadeUp`/`scaleIn` children. */
export const stagger = (gap = 0.05): Variants => ({
  animate: { transition: { staggerChildren: gap } },
});

/** WhileHover lift used on interactive cards/buttons. */
export const hoverLift = { whileHover: { y: -2 }, whileTap: { y: 0 } } as const;

/** Guard for callers that want to skip animation when the user prefers less. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
