// Shared Framer Motion variants — one motion vocabulary for the whole app.
// Every animated surface pulls from here so timing/easing stay consistent.

import type { Variants } from "framer-motion";
import { duration, easing, motionOffset } from "@/lib/design-system/animations";

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: easing.standard } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: motionOffset.md },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: easing.standard } },
  exit: { opacity: 0, y: motionOffset.sm, transition: { duration: duration.fast } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: motionOffset.lg },
  visible: { opacity: 1, x: 0, transition: { duration: duration.slow, ease: easing.standard } },
  exit: { opacity: 0, x: motionOffset.md, transition: { duration: duration.fast } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: easing.spring },
  exit: { opacity: 0, scale: 0.97, transition: { duration: duration.fast } },
};

// Drawer / sidebar sheet from the right.
export const drawer: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { duration: duration.slow, ease: easing.standard } },
  exit: { x: "100%", transition: { duration: duration.base, ease: easing.exit } },
};

// Modal dialog.
export const modal: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: easing.spring },
  exit: { opacity: 0, scale: 0.97, y: -6, transition: { duration: duration.fast } },
};

// Backdrop scrim.
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

// Stagger container — children animate in sequence.
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

// Interaction presets for whileHover / whileTap.
export const hoverLift = { y: -2, transition: { duration: duration.fast } };
export const tapPress = { scale: 0.98 };
