"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { analyzeFrame, livenessScore, startCamera, stopCamera } from "@/lib/face/browser";
import { gradeQuality } from "@/lib/face/descriptor";

interface Recognized {
  id: string;
  name: string;
  className: string;
  rollNo: string | null;
  status: string;
  confidence: number;
  at: string;
  duplicate: boolean;
}

export function LiveRecognizer({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowRef = useRef<number[][]>([]); // descriptor history for liveness
  const inflightRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [current, setCurrent] = useState<Recognized | null>(null);
  const [roster, setRoster] = useState<Recognized[]>([]);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (video && video.readyState >= 2 && !inflightRef.current) {
      inflightRef.current = true;
      try {
        const { quality, descriptor } = await analyzeFrame(video);
        const verdict = gradeQuality(quality);
        // Maintain a rolling window for liveness.
        windowRef.current.push(descriptor);
        if (windowRef.current.length > 6) windowRef.current.shift();

        if (!verdict.ok) {
          setStatus(verdict.reasons[0] ?? "Adjusting…");
        } else {
          const liveness = livenessScore(windowRef.current);
          const res = await fetch("/api/face/recognize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sessionId,
              descriptor,
              quality,
              livenessScore: liveness,
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
  }, [sessionId]);

  function handleResult(data: any) {
    if (data.decision === "RECOGNIZED" && data.student) {
      setStatus(`Recognized ${data.student.name}`);
      const rec: Recognized = {
        id: data.student.id,
        name: data.student.name,
        className: data.student.className,
        rollNo: data.student.rollNo,
        status: data.attendance?.status ?? "PRESENT",
        confidence: data.confidence,
        at: data.attendance?.recognizedAt ?? new Date().toISOString(),
        duplicate: data.attendance?.duplicate ?? false,
      };
      setCurrent(rec);
      if (!seenRef.current.has(rec.id)) {
        seenRef.current.add(rec.id);
        setRoster((r) => [rec, ...r]);
      }
    } else if (data.decision === "UNKNOWN") {
      setStatus("Unknown face");
      setCurrent({ id: "unknown", name: "Unknown Student", className: "—", rollNo: null, status: "UNKNOWN", confidence: data.confidence, at: new Date().toISOString(), duplicate: false });
    } else if (data.decision === "SPOOF_REJECTED") {
      setStatus("Spoof rejected — liveness check failed");
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
            <div
              className="rounded-full border-2 border-dashed"
              style={{ width: "40%", height: "82%", borderColor: running ? "rgb(var(--accent))" : "rgb(var(--border))" }}
            />
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
            <button onClick={start} className="btn-primary flex-1">Start recognition</button>
          ) : (
            <button onClick={stop} className="btn-secondary flex-1">Pause camera</button>
          )}
        </div>
      </div>

      {/* Recognition card + roster */}
      <div className="space-y-4">
        <div className="card p-5 min-h-[168px]">
          <div className="section-h mb-3">Last recognized</div>
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id + current.at}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold shrink-0 ${isUnknown ? "bg-error/15 text-error" : "bg-accent/15 text-accent"}`}>
                    {isUnknown ? "?" : current.name.split(" ").slice(0, 2).map((s) => s[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-medium ${isUnknown ? "text-error" : "text-fg"}`}>{current.name}</div>
                    {!isUnknown && <div className="text-xs text-muted">{current.className} · Roll {current.rollNo ?? "—"}</div>}
                    <div className="text-xs text-muted font-mono mt-0.5">
                      {new Date(current.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {isUnknown ? (
                    <span className="badge badge-error">Unknown</span>
                  ) : (
                    <>
                      <span className={`badge ${current.status === "LATE" ? "badge-warning" : "badge-success"}`}>{current.status}</span>
                      <span className="badge badge-accent">{current.confidence}% match</span>
                      {current.duplicate && <span className="badge badge-muted">Already marked</span>}
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="text-sm text-muted">Point the camera at a student to begin.</div>
            )}
          </AnimatePresence>
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="section-h">Marked this session</div>
            <span className="text-xs font-mono text-accent">{roster.length}</span>
          </div>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {roster.length === 0 && <li className="text-sm text-muted">No students marked yet.</li>}
            {roster.map((r) => (
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
