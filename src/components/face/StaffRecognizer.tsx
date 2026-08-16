"use client";

// Office-kiosk staff face attendance. Reuses the same browser capture +
// liveness helpers as the student LiveRecognizer, but posts to the
// session-less staff endpoint and renders employee results (IN/OUT punches).

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { analyzeFrame, livenessScore, startCamera, stopCamera } from "@/lib/face/browser";
import { gradeQuality } from "@/lib/face/descriptor";

interface Punched {
  id: string;
  name: string;
  employeeCode: string;
  department: string | null;
  status: string;
  punch: "IN" | "OUT";
  confidence: number;
  at: string;
}

export function StaffRecognizer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowRef = useRef<number[][]>([]);
  const inflightRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [current, setCurrent] = useState<Punched | null>(null);
  const [log, setLog] = useState<Punched[]>([]);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (video && video.readyState >= 2 && !inflightRef.current) {
      inflightRef.current = true;
      try {
        const { quality, descriptor } = await analyzeFrame(video);
        const verdict = gradeQuality(quality);
        windowRef.current.push(descriptor);
        if (windowRef.current.length > 6) windowRef.current.shift();
        if (!verdict.ok) {
          setStatus(verdict.reasons[0] ?? "Adjusting…");
        } else {
          const res = await fetch("/api/face/staff-recognize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              descriptor,
              quality,
              livenessScore: livenessScore(windowRef.current),
              deviceInfo: navigator.userAgent.slice(0, 120),
            }),
          });
          const data = await res.json();
          if (res.ok) handleResult(data);
        }
      } catch {
        setStatus("Recognition error — retrying");
      } finally {
        inflightRef.current = false;
      }
    }
    timerRef.current = setTimeout(tick, 700);
  }, []);

  function handleResult(data: any) {
    if (data.decision === "RECOGNIZED" && data.staff) {
      const rec: Punched = {
        id: data.staff.id,
        name: data.staff.name,
        employeeCode: data.staff.employeeCode,
        department: data.staff.department,
        status: data.attendance?.status ?? "PRESENT",
        punch: data.attendance?.punch ?? "IN",
        confidence: data.confidence,
        at: data.attendance?.lastOutAt ?? new Date().toISOString(),
      };
      setStatus(`${rec.punch === "IN" ? "Checked in" : "Updated"} · ${rec.name}`);
      setCurrent(rec);
      // De-dupe rapid repeats within the session; always show the latest state.
      const key = rec.id + rec.punch;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        setLog((l) => [rec, ...l.filter((x) => x.id !== rec.id)]);
      }
    } else if (data.decision === "UNKNOWN") {
      setStatus("Unknown face — not enrolled");
      setCurrent({ id: "unknown", name: "Unknown", employeeCode: "—", department: null, status: "UNKNOWN", punch: "IN", confidence: data.confidence, at: new Date().toISOString() });
    } else if (data.decision === "SPOOF_REJECTED") {
      setStatus("Spoof / replay rejected");
    } else if (data.decision === "LOW_CONFIDENCE") {
      setStatus(`Low confidence (${data.confidence}%) — hold steady`);
    } else if (data.decision === "QUALITY_REJECTED") {
      setStatus("Improve lighting / framing");
    }
  }

  async function start() {
    try {
      if (!videoRef.current) return;
      streamRef.current = await startCamera(videoRef.current);
      setRunning(true);
      setStatus("Scanning…");
      tick();
    } catch (e: any) {
      setCamError(e?.name === "NotAllowedError" ? "Camera permission denied" : "Could not start camera");
    }
  }
  function stop() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopCamera(streamRef.current);
    setRunning(false);
    setStatus("Stopped");
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); stopCamera(streamRef.current); }, []);

  const isUnknown = current?.id === "unknown";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card p-4">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full border-2 border-dashed" style={{ width: "40%", height: "82%", borderColor: running ? "rgb(var(--accent))" : "rgb(var(--border))" }} />
          </div>
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${running ? "bg-accent animate-pulse" : "bg-subtle"}`} />
            <span className="text-xs text-white/80 font-mono">{status}</span>
          </div>
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center p-6">
              <div className="text-error text-sm">{camError}</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {!running ? (
            <button onClick={start} className="btn-primary flex-1">Start office kiosk</button>
          ) : (
            <button onClick={stop} className="btn-secondary flex-1">Pause camera</button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5 min-h-[168px]">
          <div className="section-h mb-3">Last punch</div>
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current.id + current.at} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold shrink-0 ${isUnknown ? "bg-error/15 text-error" : "bg-accent/15 text-accent"}`}>
                    {isUnknown ? "?" : current.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-medium ${isUnknown ? "text-error" : "text-fg"}`}>{current.name}</div>
                    {!isUnknown && <div className="text-xs text-muted">{current.employeeCode}{current.department ? ` · ${current.department}` : ""}</div>}
                    <div className="text-xs text-muted font-mono mt-0.5">{new Date(current.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {isUnknown ? (
                    <span className="badge badge-error">Unknown</span>
                  ) : (
                    <>
                      <span className={`badge ${current.punch === "IN" ? "badge-success" : "badge-info"}`}>{current.punch === "IN" ? "Checked in" : "Check out"}</span>
                      <span className={`badge ${current.status === "LATE" ? "badge-warning" : "badge-success"}`}>{current.status}</span>
                      <span className="badge badge-accent">{current.confidence}%</span>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="text-sm text-muted">Point the camera at a staff member to begin.</div>
            )}
          </AnimatePresence>
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="section-h">Punched this session</div>
            <span className="text-xs font-mono text-accent">{log.length}</span>
          </div>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {log.length === 0 && <li className="text-sm text-muted">No staff punched yet.</li>}
            {log.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm border-b border-border pb-1.5 last:border-0">
                <span className="text-fg truncate">{r.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${r.status === "LATE" ? "badge-warning" : "badge-success"}`}>{r.status}</span>
                  <span className="text-xs text-muted font-mono">{r.confidence}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
