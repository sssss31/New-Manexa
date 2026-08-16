"use client";

// Reusable motion wrappers built on the shared variants. Import these instead of
// hand-writing `motion.div` with ad-hoc transitions, so animation stays uniform.
// All respect prefers-reduced-motion via the CSS reset in globals.css + Framer's
// own reduced-motion handling.

import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { fade, fadeUp, scaleIn, slideInRight, staggerContainer, hoverLift, tapPress } from "./variants";

type DivProps = HTMLMotionProps<"div"> & { children?: ReactNode };

export function Fade(props: DivProps) {
  return <motion.div variants={fade} initial="hidden" animate="visible" exit="exit" {...props} />;
}

export function FadeUp(props: DivProps) {
  return <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit" {...props} />;
}

export function SlideIn(props: DivProps) {
  return <motion.div variants={slideInRight} initial="hidden" animate="visible" exit="exit" {...props} />;
}

export function Scale(props: DivProps) {
  return <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit" {...props} />;
}

/** Wrap a list; give each child `variants={fadeUp}` to cascade them in. */
export function Stagger(props: DivProps) {
  return <motion.div variants={staggerContainer} initial="hidden" animate="visible" {...props} />;
}

/** Interactive card/button with the standard lift + press feedback. */
export function Interactive(props: DivProps) {
  return <motion.div whileHover={hoverLift} whileTap={tapPress} {...props} />;
}

/** Page-transition wrapper — mount at the top of a route's client tree. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export { AnimatePresence, motion };
