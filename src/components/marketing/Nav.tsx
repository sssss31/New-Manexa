"use client";

// Floating glass navbar — sticky, blur, rounded, scroll-aware, with a mobile
// sheet. Links smooth-scroll to sections.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-3 inset-x-0 z-50 flex justify-center px-4">
      <nav
        className={cn(
          "w-full max-w-5xl rounded-2xl px-4 py-2.5 flex items-center justify-between transition-all duration-300",
          scrolled ? "mkt-glass-strong shadow-2xl" : "mkt-glass"
        )}
      >
        <Link href="/" aria-label="MANEXA home" className="flex items-center">
          <Logo size={26} />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="mkt-btn-ghost text-sm !py-2 !px-4">Sign in</Link>
          <Link href="/signup?tab=create" className="mkt-btn-primary text-sm !py-2 !px-4">Get started</Link>
        </div>

        <button
          className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden absolute top-16 inset-x-4 mkt-glass-strong rounded-2xl p-4 flex flex-col gap-1"
          >
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2.5 text-white/80 hover:text-white rounded-lg hover:bg-white/5">
                {l.label}
              </a>
            ))}
            <div className="h-px bg-white/10 my-2" />
            <Link href="/login" onClick={() => setOpen(false)} className="mkt-btn-ghost justify-center">Sign in</Link>
            <Link href="/signup?tab=create" onClick={() => setOpen(false)} className="mkt-btn-primary justify-center mt-1">Get started</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
