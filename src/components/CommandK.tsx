"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export type CommandItem = { label: string; href: string; section?: string };

export function CommandK({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const base = needle
      ? items.filter(
          (i) =>
            i.label.toLowerCase().includes(needle) ||
            (i.section ?? "").toLowerCase().includes(needle)
        )
      : items;
    return base.slice(0, 10);
  }, [items, q]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ("");
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setActive(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 text-sm text-muted bg-elevated border border-border rounded-xl px-3 py-1.5 hover:border-accent/40 transition-colors"
        aria-label="Open command palette"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        Search
        <kbd className="text-[10px] font-mono border border-border rounded px-1 py-0.5 bg-surface">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {/* Deliberate raw black: a modal scrim stays dark in both themes,
                so this must NOT be tokenised to bg-bg/70. */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-lg card overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -6 }}
              transition={{ type: "spring", duration: 0.28, bounce: 0.15 }}
            >
              <div className="flex items-center gap-2 px-4 border-b border-border">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setActive(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                    if (e.key === "Enter" && filtered[active]) go(filtered[active].href);
                  }}
                  placeholder="Jump to a page…"
                  className="w-full bg-transparent py-3.5 text-sm text-fg placeholder:text-subtle focus:outline-none"
                  aria-label="Search pages"
                />
              </div>
              <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
                {filtered.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>
                )}
                {filtered.map((item, i) => (
                  <li key={item.href}>
                    <button
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setActive(i)}
                      role="option"
                      aria-selected={i === active}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
                        i === active ? "bg-accent/10 text-accent" : "text-fg"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.section && <span className="text-xs text-subtle">{item.section}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[11px] text-subtle">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> open</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
