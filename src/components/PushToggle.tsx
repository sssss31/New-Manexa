"use client";

// One-tap opt-in for phone push notifications. Registers the service worker,
// asks the OS for permission, subscribes via the Push API (VAPID), and stores
// the subscription server-side. Renders nothing on unsupported browsers.

import { useEffect, useState } from "react";
import { toast } from "sonner";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Notification !== "undefined" &&
      Boolean(VAPID_PUBLIC);
    setState(supported ? (Notification.permission as State) : "unsupported");
  }, []);

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission as State);
        if (permission === "denied") {
          toast.error("Notifications blocked", {
            description: "Browser settings me MANEXA ke liye notifications allow karein.",
          });
        }
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) as BufferSource,
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      if (!res.ok) throw new Error(`subscribe ${res.status}`);

      setState("granted");
      toast.success("Phone notifications on 🔔", {
        description: "Attendance, results aur notices ab aapke phone par push honge.",
      });
    } catch {
      toast.error("Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  if (state === "granted") {
    return (
      <span className="badge inline-flex items-center gap-1 text-xs text-success">
        <span className="dot bg-success" /> Phone push on
      </span>
    );
  }

  if (state === "denied") {
    return <span className="text-xs text-muted">Notifications blocked in browser</span>;
  }

  return (
    <button onClick={enable} disabled={busy} className="btn-secondary text-xs gap-1.5">
      {busy ? "Enabling…" : "🔔 Enable phone notifications"}
    </button>
  );
}
