"use client";

// Shared, RBAC-agnostic calendar renderer. It only draws the items the server
// already scoped + shaped — it never fetches. Month navigation is a server
// round-trip (?month=YYYY-MM) so each view loads only that month; the category
// filter and month/agenda toggle are local (no refetch needed).

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_META, type CalendarCategory, type CalendarViewItem } from "@/lib/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CATS: CalendarCategory[] = ["EVENT", "HOLIDAY", "MEETING", "EXAM", "ASSIGNMENT", "FINANCE", "LEAVE"];

function ym(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
function monthLabel(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function CalendarView({
  items,
  year,
  monthIndex,
  today,
  basePath,
}: {
  items: CalendarViewItem[];
  year: number;
  monthIndex: number;
  today: string; // IST YYYY-MM-DD
  basePath: string;
}) {
  const [active, setActive] = useState<Set<CalendarCategory>>(new Set());
  const [view, setView] = useState<"month" | "agenda">("month");

  const shown = useMemo(
    () => (active.size === 0 ? items : items.filter((i) => active.has(i.category))),
    [items, active]
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarViewItem[]>();
    for (const i of shown) {
      if (!m.has(i.dayKey)) m.set(i.dayKey, []);
      m.get(i.dayKey)!.push(i);
    }
    return m;
  }, [shown]);

  // Build a Sun-first 6-week grid of YYYY-MM-DD keys.
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, monthIndex, 1));
    const startPad = first.getUTCDay();
    const out: { key: string; inMonth: boolean; day: number }[] = [];
    for (let idx = 0; idx < 42; idx++) {
      const d = new Date(Date.UTC(year, monthIndex, 1 - startPad + idx));
      out.push({
        key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
        inMonth: d.getUTCMonth() === monthIndex,
        day: d.getUTCDate(),
      });
    }
    return out;
  }, [year, monthIndex]);

  const prev = ym(monthIndex === 0 ? year - 1 : year, monthIndex === 0 ? 11 : monthIndex - 1);
  const next = ym(monthIndex === 11 ? year + 1 : year, monthIndex === 11 ? 0 : monthIndex + 1);

  function toggle(c: CalendarCategory) {
    setActive((s) => {
      const n = new Set(s);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  }

  return (
    <div className="glass-panel p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?month=${prev}`} className="btn-ghost w-9 h-9 p-0" aria-label="Previous month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <h2 className="font-display text-lg text-fg min-w-[9rem] text-center">{monthLabel(year, monthIndex)}</h2>
          <Link href={`${basePath}?month=${next}`} className="btn-ghost w-9 h-9 p-0" aria-label="Next month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href={basePath} className="btn-ghost text-xs">Today</Link>
        </div>
        <div className="inline-flex rounded-xl border border-border overflow-hidden">
          <button onClick={() => setView("month")} className={`px-3 py-1.5 text-sm ${view === "month" ? "bg-accent/12 text-accent" : "text-muted"}`}>Month</button>
          <button onClick={() => setView("agenda")} className={`px-3 py-1.5 text-sm ${view === "agenda" ? "bg-accent/12 text-accent" : "text-muted"}`}>Agenda</button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setActive(new Set())} className={`text-xs rounded-full px-2.5 py-1 border ${active.size === 0 ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted"}`}>All</button>
        {CATS.map((c) => (
          <button key={c} onClick={() => toggle(c)} className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${active.has(c) ? CATEGORY_META[c].tw : "border-border text-muted hover:text-fg"}`}>
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {view === "month" ? (
        <>
          {/* Desktop month grid; hidden on small screens (agenda used there). */}
          <div className="hidden sm:grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-surface px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted text-center">{w}</div>
            ))}
            {cells.map((c) => {
              const dayItems = byDay.get(c.key) ?? [];
              const isToday = c.key === today;
              return (
                <div key={c.key} className={`bg-bg min-h-[92px] p-1.5 ${c.inMonth ? "" : "opacity-40"}`}>
                  <div className={`text-xs mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-accent text-accent-fg font-semibold" : "text-muted"}`}>{c.day}</div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((i) => <ItemChip key={i.id} item={i} />)}
                    {dayItems.length > 3 && <div className="text-[10px] text-muted pl-1">+{dayItems.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mobile: fall back to the agenda list. */}
          <div className="sm:hidden"><Agenda items={shown} today={today} /></div>
        </>
      ) : (
        <Agenda items={shown} today={today} />
      )}

      {shown.length === 0 && (
        <div className="text-center text-sm text-muted py-10">Nothing scheduled for this month.</div>
      )}
    </div>
  );
}

function ItemChip({ item }: { item: CalendarViewItem }) {
  const chip = (
    <div className={`text-[11px] leading-tight rounded px-1.5 py-0.5 border truncate ${CATEGORY_META[item.category].tw}`} title={`${item.title}${item.detail ? ` · ${item.detail}` : ""}`}>
      {item.title}
    </div>
  );
  return item.href ? <Link href={item.href}>{chip}</Link> : chip;
}

function Agenda({ items, today }: { items: CalendarViewItem[]; today: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, CalendarViewItem[]>();
    for (const i of items) {
      if (!m.has(i.dayKey)) m.set(i.dayKey, []);
      m.get(i.dayKey)!.push(i);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [items]);

  if (groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {groups.map(([day, list]) => (
        <div key={day}>
          <div className={`text-xs font-medium mb-1.5 ${day === today ? "text-accent" : "text-muted"}`}>
            {new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
            {day === today ? " · Today" : ""}
          </div>
          <div className="space-y-1.5">
            {list.map((i) => {
              const row = (
                <div className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                  <span className={`text-[10px] rounded px-1.5 py-0.5 border shrink-0 ${CATEGORY_META[i.category].tw}`}>{CATEGORY_META[i.category].label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-fg truncate">{i.title}</div>
                    {i.detail && <div className="text-xs text-muted truncate">{i.detail}</div>}
                  </div>
                  <span className="text-xs text-muted font-mono shrink-0">{i.timeLabel}</span>
                </div>
              );
              return <div key={i.id}>{i.href ? <Link href={i.href}>{row}</Link> : row}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
