"use client";

// Teacher / staff self check-in by face. Verifies the presented face against the
// signed-in person's OWN enrolled template (server-side) and records their
// StaffAttendance punch. Success is shown ONLY after the server confirms the DB
// write — never on camera detection alone.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { analyzeFrame, livenessScore, startCamera, stopCamera } from "@/lib/face/browser";
import { gradeQuality } from "@/lib/face/descriptor";

type Phase =
  | "idle"
  | "scanning" // camera on, looking for a good frame
  | "verifying" // a good frame was sent to the server
  | "marked" // terminal success
  | "already" // terminal success (idempotent)
  | "camera-error";

interface SuccessInfo {
  status: string; // PRESENT | LATE
  checkInAt: string;
  already: boolean;
}

export function SelfCheckIn({
  enrolled,
  displayName,
  roleLabel,
  initial,
}: {
  enrolled: boolean;
  displayName: string;
  roleLabel: string;
  /** Today's attendance if it already exists (server-rendered). */
  initial?: { status: string; checkInAt: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowRef = useRef<number[][]>([]);
  const inflightRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(initial ? "already" : "idle");
  const [hint, setHint] = useState("Camera off");
  const [camError, setCamError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(
    initial ? { status: initial.status, checkInAt: initial.checkInAt, already: true } : null
  );
  const [confidence, setConfidence] = useState<number | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopCamera(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const finishSuccess = useCallback(
    (info: SuccessInfo, conf: number) => {
      cleanup();
      setConfidence(conf);
      setSuccess(info);
      setPhase(info.already ? "already" : "marked");
    },
    [cleanup]
  );

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
          setPhase("scanning");
          setHint(verdict.reasons[0] ?? "Position your face in the frame");
        } else {
          setPhase("verifying");
          setHint("Verifying your identity…");
          const res = await fetch("/api/face/self-attendance", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              descriptor,
              quality,
              livenessScore: livenessScore(windowRef.current),
              deviceInfo: navigator.userAgent.slice(0, 120),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            // 403 no-staff, 429 rate limit, 5xx, etc. — surface, keep scanning.
            setPhase("scanning");
            setHint(data?.error ?? "Couldn't reach the server — retrying…");
          } else if (data.decision === "MARKED") {
            finishSuccess({ status: data.attendance.status, checkInAt: data.attendance.checkInAt, already: false }, data.confidence);
            return; // stop the loop
          } else if (data.decision === "ALREADY_MARKED") {
            finishSuccess({ status: data.attendance.status, checkInAt: data.attendance.checkInAt, already: true }, data.confidence);
            return;
          } else if (data.decision === "NO_MATCH") {
            setPhase("scanning");
            setHint(`That doesn't match your Face ID (${data.confidence}%). Look straight at the camera.`);
          } else if (data.decision === "NOT_ENROLLED") {
            setPhase("scanning");
            setHint("You haven't set up Face ID yet. Set it up first.");
          } else if (data.decision === "SPOOF_REJECTED") {
            setPhase("scanning");
            setHint("Liveness check failed — use your live face, not a photo/screen.");
          } else {
            setPhase("scanning");
            setHint("Improve lighting and hold still…");
          }
        }
      } catch {
        setPhase("scanning");
        setHint("Something went wrong reading the camera — retrying…");
      } finally {
        inflightRef.current = false;
      }
    }
    timerRef.current = setTimeout(tick, 700);
  }, [finishSuccess]);

  async function start() {
    setCamError(null);
    try {
      if (!videoRef.current) return;
      streamRef.current = await startCamera(videoRef.current);
      setPhase("scanning");
      setHint("Position your face in the frame");
      tick();
    } catch (e: any) {
      cleanup();
      setPhase("camera-error");
      setCamError(
        e?.name === "NotAllowedError" || e?.name === "SecurityError"
          ? "Camera permission blocked — allow it (address-bar icon) and try again."
          : e?.name === "NotReadableError"
          ? "Camera is busy — close other apps/tabs using it and try again."
          : e?.name === "NotFoundError"
          ? "No camera found on this device."
          : "Could not start the camera. Check it isn't blocked or in use."
      );
    }
  }

  function reset() {
    cleanup();
    setSuccess(null);
    setConfidence(null);
    setPhase("idle");
    setHint("Camera off");
  }

  // ---- Not enrolled: dead-end guidance, no camera. ----
  if (!enrolled) {
    return (
      <div className="card p-8 text-center max-w-reading mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-warning/15 text-warning mx-auto flex items-center justify-center mb-4" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="font-display text-xl text-fg">Set up Face ID first</h2>
        <p className="text-sm text-muted mt-2">You need to register your face before you can check in with it.</p>
        <Link href="/teacher/face" className="btn-primary mt-5 inline-flex">Set up Face ID</Link>
      </div>
    );
  }

  const terminal = phase === "marked" || phase === "already";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Camera */}
      <div className="lg:col-span-2 card p-4">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} className={`w-full h-full object-cover ${terminal ? "opacity-40" : ""}`} muted playsInline />
          {/* Face guide ring */}
          {!terminal && phase !== "camera-error" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-full border-2 border-dashed transition-colors"
                style={{ width: "42%", height: "82%", borderColor: phase === "verifying" ? "rgb(var(--accent))" : "rgb(var(--border))" }}
              />
            </div>
          )}
          {/* Live status pill */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${phase === "scanning" || phase === "verifying" ? "bg-accent animate-pulse" : "bg-subtle"}`} />
            <span className="text-xs text-white/85 font-mono">
              {phase === "idle" && "Camera Ready"}
              {phase === "scanning" && "Scanning…"}
              {phase === "verifying" && "Verifying…"}
              {phase === "marked" && "Identity confirmed"}
              {phase === "already" && "Already checked in"}
              {phase === "camera-error" && "Camera error"}
            </span>
          </div>
          {/* Terminal success overlay */}
          <AnimatePresence>
            {terminal && success && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm text-center p-6"
              >
                <div>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-2xl bg-accent/20 text-accent mx-auto flex items-center justify-center mb-3"
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </motion.div>
                  <div className="text-white font-display text-lg">
                    {success.already ? "Already marked present" : "Attendance marked"}
                  </div>
                  <div className="text-white/70 text-sm mt-0.5">{displayName} · {roleLabel}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Camera error */}
          {phase === "camera-error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-center p-6">
              <div className="text-error text-sm max-w-xs">{camError}</div>
            </div>
          )}
        </div>

        {!terminal && (
          <div className="flex gap-2 mt-3">
            {phase === "idle" || phase === "camera-error" ? (
              <button onClick={start} className="btn-primary flex-1">Start Face check-in</button>
            ) : (
              <button onClick={reset} className="btn-secondary flex-1">Cancel</button>
            )}
          </div>
        )}
        {!terminal && phase !== "idle" && phase !== "camera-error" && (
          <p className="text-xs text-muted text-center mt-2">{hint}</p>
        )}
      </div>

      {/* Result panel */}
      <div className="card p-5">
        <div className="section-h mb-3">Today&apos;s check-in</div>
        {success ? (
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center font-semibold shrink-0">
                {displayName.split(" ").slice(0, 2).map((s) => s[0]).join("")}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-fg truncate">{displayName}</div>
                <div className="text-xs text-muted">{roleLabel}</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Row k="Status" v={<span className={`badge ${success.status === "LATE" ? "badge-warning" : "badge-success"}`}>{success.status}</span>} />
              <Row k="Check-in" v={<span className="font-mono text-fg">{new Date(success.checkInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>} />
              <Row k="Method" v={<span className="badge badge-accent">Face</span>} />
              {confidence != null && <Row k="Face match" v={<span className="text-fg">Verified · {confidence}%</span>} />}
            </div>
            {terminal && (
              <button onClick={reset} className="btn-ghost w-full mt-4 text-sm">Done</button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted">
            Not checked in yet today. Start the camera and look straight at it to mark your attendance.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{k}</span>
      {v}
    </div>
  );
}
