"use client";

// Scroll-reveal wrapper — fades + lifts content into view once. Respects
// prefers-reduced-motion via Framer's global reducedMotion handling.
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  ...rest
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.21, 1, 0.36, 1], delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Stagger container — children with `variants={revealChild}` cascade in.
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const EASE = [0.21, 1, 0.36, 1] as [number, number, number, number];

export const revealChild = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
} satisfies Variants;

// A single staggered child. Use inside <RevealGroup> from a Server Component so
// `motion` stays in the client boundary (motion.* can't render server-side).
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={revealChild} className={className}>
      {children}
    </motion.div>
  );
}
