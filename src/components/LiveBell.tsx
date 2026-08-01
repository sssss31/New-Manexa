"use client";

// App-wide real-time notification bell. Polls the authenticated live endpoint
// (React Query), raises a sonner toast for every notification created after
// the session's first poll, and keeps the unread badge live — no page refresh.
// Because every module's events land in the one Notification table, this
// single component makes ALL modules live at once. Swap the poller for
// Supabase Realtime later and nothing else changes.
//
// Cursor discipline: the cursor ALWAYS comes from the server (derived from DB
// row timestamps). The browser clock is never consulted — a skewed client
// clock used to either replay old notifications or kill the bell entirely.

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type LiveItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  targeted: boolean;
};
type LiveResp = { unread: number; cursor: string; items: LiveItem[] };

async function fetchLive(since: string | null): Promise<LiveResp> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await fetch(`/api/notifications/live${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`live ${res.status}`);
  return res.json();
}

export function LiveBell({ initialUnread }: { initialUnread: number }) {
  // null cursor → the first poll asks the server for a DB-derived starting
  // point (and returns no items, so history is never replayed on page load).
  const sinceRef = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["notif-live"],
    queryFn: () => fetchLive(sinceRef.current),
    // Poll every 15s while the tab is visible; pause when hidden.
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible" ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data) return;
    // Always advance to the server-supplied cursor — even on empty polls.
    if (data.cursor) sinceRef.current = data.cursor;
    for (const it of data.items ?? []) {
      if (seen.current.has(it.id)) continue;
      seen.current.add(it.id);
      toast(it.title, {
        description: it.body,
        action: it.href
          ? { label: "View", onClick: () => { window.location.href = it.href!; } }
          : undefined,
      });
    }
    // Bound the dedupe set (it lives for the whole session).
    if (seen.current.size > 500) {
      seen.current = new Set(Array.from(seen.current).slice(-200));
    }
  }, [data]);

  const unread = data?.unread ?? initialUnread;

  return (
    <Link
      href="/notifications"
      className="btn-ghost w-9 h-9 p-0 relative"
      aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
      title="Notifications"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
        <path d="M10 21a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-fg text-[10px] font-semibold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
