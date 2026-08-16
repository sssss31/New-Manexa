import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely: clsx resolves conditionals, tailwind-merge
 * dedupes conflicting utilities (last-wins). Use for every className that mixes
 * a base with variants/overrides.
 *   cn("btn", isActive && "btn-primary", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
