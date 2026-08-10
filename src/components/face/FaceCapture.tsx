"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { analyzeFrame, startCamera, stopCamera } from "@/lib/face/browser";
import { gradeQuality, POSE_GUIDE, ENROLL_POSES, type Pose } from "@/lib/face/descriptor";

type PoseState = "pending" | "captured";

export function FaceCapture({
  subjectType,
  subjectId,
  subjectName,
}: {
  subjectType: "STUDENT" | "STAFF";
  subjectId: string;
  subjectName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [live, setLive] = useState<{ score: number; brightness: number; sharpness: number; faceBoxPx: number; reasons: string[] }>({
    score: 0, brightness: 0, sharpness: 0, faceBoxPx: 0, reasons: ["Starting camera…"],
  });
  const [poseState, setPoseState] = useState<Record<Pose, PoseState>>(
    Object.fromEntries(ENROLL_POSES.map((p) => [p, "pending"])) as Record<Pose, PoseState>
  );
  const [activePose, setActivePose] = useState<Pose>("FRONT");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Continuous quality loop for the live indicators.
  const loop = useCallback(async () => {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      try {
        const { quality } = await analyzeFrame(video);
        const verdict = gradeQuality(quality);
        setLive({
          score: verdict.score,
          brightness: quality.brightness,
          sharpness: quality.sharpness,
          faceBoxPx: quality.faceBoxPx,
          reasons: verdict.reasons,
        });
      } catch {}
    }
    rafRef.current = requestAnimationFrame(() => setTimeout(loop, 220));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!videoRef.current) return;
        streamRef.current = await startCamera(videoRef.current);
        if (!mounted) return;
        setCamReady(true);
        loop();
      } catch (e: any) {
        setCamError(e?.name === "NotAllowedError" ? "Camera permission denied" : "Could not start camera");
      }
    })();
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
    };
  }, [loop]);

  async function capture() {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    setToast(null);
    try {
      const { quality, descriptor } = await analyzeFrame(video);
      const verdict = gradeQuality(quality);
      if (!verdict.ok) {
        setToast({ kind: "err", msg: `Rejected: ${verdict.reasons.join(", ")}` });
        setBusy(false);
        return;
      }
      const res = await fetch("/api/face/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, pose: activePose, descriptor, quality }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "err", msg: data.error ?? "Enrolment failed" });
      } else {
        setPoseState((s) => ({ ...s, [activePose]: "captured" }));
        setToast({ kind: "ok", msg: `${activePose} captured · quality ${data.quality}%` });
        const next = ENROLL_POSES.find((p) => p !== activePose && poseState[p] === "pending");
        if (next) setActivePose(next);
      }
    } catch {
      setToast({ kind: "err", msg: "Capture failed" });
    } finally {
      setBusy(false);
    }
  }

  const captured = Object.values(poseState).filter((s) => s === "captured").length;
  const canCapture = camReady && live.reasons.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Camera + live quality */}
      <div className="card p-4">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {/* Face guide ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-full border-2 border-dashed transition-colors"
              style={{
                width: "58%", height: "78%",
                borderColor: canCapture ? "rgb(var(--accent))" : "rgb(var(--border))",
              }}
            />
          </div>
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center p-6">
              <div>
                <div className="text-error font-medium">{camError}</div>
                <div className="text-xs text-muted mt-2">Allow camera access and reload to enrol faces.</div>
              </div>
            </div>
          )}
          {/* Live quality meter */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${live.score}%`,
                    background: live.score >= 55 ? "rgb(var(--accent))" : "rgb(var(--warning))",
                  }}
                />
              </div>
              <span className="text-xs font-mono text-white tabular-nums">{live.score}%</span>
            </div>
            <div className="text-[11px] text-white/70 mt-1 h-4">
              {live.reasons.length ? live.reasons.join(" · ") : "Quality OK — ready to capture"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Metric label="Brightness" value={live.brightness} unit="" />
          <Metric label="Sharpness" value={live.sharpness} unit="" />
          <Metric label="Face size" value={live.faceBoxPx} unit="px" />
        </div>

        <button
          onClick={capture}
          disabled={!canCapture || busy}
          className="btn-primary w-full mt-3"
        >
          {busy ? "Analysing…" : `Capture ${activePose.replace(/(\d+)/, " $1°")}`}
        </button>
        {toast && (
          <div className={`mt-2 badge w-full py-2 justify-center ${toast.kind === "ok" ? "badge-success" : "badge-error"}`}>
            {toast.msg}
          </div>
        )}
      </div>

      {/* Pose checklist */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-display text-lg text-fg">Enrol {subjectName}</h3>
          <span className="text-xs text-muted font-mono">{captured}/{ENROLL_POSES.length}</span>
        </div>
        <p className="text-sm text-muted mb-4">
          Capture two quick frames — front &amp; neutral. Each is quality-checked before it&apos;s accepted; embeddings are encrypted server-side and never leave the server.
        </p>
        <div className="space-y-2">
          {ENROLL_POSES.map((p) => {
            const done = poseState[p] === "captured";
            const active = p === activePose;
            return (
              <motion.button
                key={p}
                onClick={() => setActivePose(p)}
                layout
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  active ? "border-accent bg-accent/10" : "border-border hover:border-accent/30"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    done ? "bg-accent text-accent-fg" : "bg-elevated text-muted"
                  }`}
                >
                  {done ? "✓" : "○"}
                </span>
                <span className="flex-1">
                  <span className={`text-sm font-medium ${active ? "text-accent" : "text-fg"}`}>
                    {p.replace(/(\d+)/, " $1°")}
                  </span>
                  <span className="block text-xs text-muted">{POSE_GUIDE[p]}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
        {captured === ENROLL_POSES.length && (
          <div className="mt-4 badge badge-success w-full py-2 justify-center animate-pop">
            Enrolled — {subjectName} is ready for face attendance.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="border border-border rounded-xl p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-mono text-fg tabular-nums">{value}{unit}</div>
    </div>
  );
}
