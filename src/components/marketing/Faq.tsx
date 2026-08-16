"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const ITEMS = [
  { q: "How fast can a school get started?", a: "Minutes. Create your institution, get a unique MANEXA ID (e.g. MAN-SCH-100001), and MANEXA auto-provisions your academic session, classes and role permissions. Import students via CSV or add them as you go." },
  { q: "Is our data isolated from other schools?", a: "Completely. MANEXA is multi-tenant with strict per-institution isolation — every record and query is scoped to your institution ID. No school can ever see another school's data." },
  { q: "What does the AI actually do?", a: "It predicts at-risk students, forecasts fee defaulters, surfaces attendance trends, answers questions in plain English over your live data, and powers face-recognition attendance — all from the data you already have." },
  { q: "How does pricing work?", a: "Simple per-student pricing with a 14-day free trial. Plans scale from Starter to Enterprise; you only pay for active students. No setup fees, cancel anytime." },
  { q: "Can teachers, parents and students all use it?", a: "Yes — every institution gets role-based portals for admins, principals, teachers, accountants, parents and students, included automatically. No per-portal licensing." },
  { q: "Does it work on mobile?", a: "Fully responsive across desktop, tablet and mobile, with dedicated parent and student experiences designed for phones." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl mx-auto divide-y divide-white/10">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="py-1">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-4 text-left group"
              aria-expanded={isOpen}
            >
              <span className={`text-base md:text-lg font-medium transition-colors ${isOpen ? "text-white" : "text-white/80 group-hover:text-white"}`}>
                {item.q}
              </span>
              <Plus
                size={20}
                className={`shrink-0 text-accent transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.21, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 pr-8 text-sm md:text-[15px] text-white/60 leading-relaxed">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
