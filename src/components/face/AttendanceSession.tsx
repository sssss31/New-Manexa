"use client";

import { useState } from "react";
import { LiveRecognizer } from "./LiveRecognizer";

interface SectionOpt { id: string; label: string; classId: string; }
interface SubjectOpt { id: string; name: string; }

export function AttendanceSession({
  sections,
  subjects,
  devices,
}: {
  sections: SectionOpt[];
  subjects: SubjectOpt[];
  devices: { id: string; name: string }[];
}) {
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ id: string; threshold: number } | null>(null);

  async function start() {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) { setError("Select a class & section"); return; }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/face/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: section.classId,
          sectionId: section.id,
          subjectId: subjectId || undefined,
          period: period || undefined,
          deviceId: deviceId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not start session");
      else setSession({ id: data.sessionId, threshold: data.threshold });
    } catch {
      setError("Network error");
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    if (!session) return;
    await fetch(`/api/face/session?id=${session.id}`, { method: "DELETE" });
    setSession(null);
  }

  if (session) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4 card p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-fg font-medium">Session live</span>
            <span className="text-muted">· threshold {session.threshold}% · duplicates auto-blocked</span>
          </div>
          <button onClick={stop} className="btn-danger text-sm">End session</button>
        </div>
        <LiveRecognizer sessionId={session.id} />
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="font-display text-lg text-fg mb-1">Start attendance session</h3>
      <p className="text-sm text-muted mb-5">Select the class, then walk students past the camera. Recognition marks Present automatically.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Class & Section</label>
          <select className="select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Select…</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Subject (optional)</label>
          <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">—</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Period (optional)</label>
          <input className="input" type="number" min={1} max={12} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 3" />
        </div>
        <div>
          <label className="label">Device (optional)</label>
          <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">This device</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="badge badge-error w-full py-2 justify-center mt-4">{error}</div>}
      <button onClick={start} disabled={starting} className="btn-primary w-full mt-5">
        {starting ? "Starting…" : "Start session"}
      </button>
    </div>
  );
}
