"use client";

// Small reusable client hooks used across the UI layer.
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

/** Toast helpers on the MANEXA palette — success uses the accent tone. */
export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  error: (msg: string, description?: string) => toast.error(msg, { description }),
  info: (msg: string, description?: string) => toast(msg, { description }),
  promise: toast.promise,
};

/** True once mounted on the client — guards hydration-sensitive UI. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Reactive media-query match (SSR-safe: false until mounted). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const on = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Bind a keyboard shortcut, e.g. useShortcut("mod+k", open). */
export function useShortcut(keys: string, handler: () => void) {
  useHotkeys(keys, (e) => {
    e.preventDefault();
    handler();
  });
}

export { useHotkeys };
