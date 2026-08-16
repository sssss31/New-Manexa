"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnknownActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function resolve(resolution: "IGNORED" | "REGISTERED" | "RETRIED") {
    setBusy(true);
    await fetch("/api/face/unknown", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unknownId: id, resolution }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      <button disabled={busy} onClick={() => resolve("IGNORED")} className="btn-ghost text-xs">Ignore</button>
      <button disabled={busy} onClick={() => resolve("RETRIED")} className="btn-secondary text-xs">Retry</button>
      <button disabled={busy} onClick={() => resolve("REGISTERED")} className="btn-primary text-xs">Register new</button>
    </div>
  );
}
