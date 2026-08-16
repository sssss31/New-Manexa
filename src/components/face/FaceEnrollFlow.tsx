"use client";

// Self-service "Face ID" setup — a calm, stepped wrapper around the existing
// FaceCapture engine. It defers mounting the camera until the user opts in, so
// the browser's permission prompt only appears on intent (Step 2 in the spec),
// and hides all biometric jargon. The heavy lifting (capture, quality grading,
// encrypted server-side enrolment) is unchanged — this only reframes the UX.

import { useState } from "react";
import { motion } from "framer-motion";
import { FaceCapture } from "./FaceCapture";

type Step = "intro" | "capture" | "done";

function FaceIdGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" strokeLinecap="round" />
      <path d="M9 10h.01M15 10h.01M9.5 14.5a3.5 3.5 0 0 0 5 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FaceEnrollFlow({
  subjectId,
  subjectName,
  alreadyEnrolled = false,
}: {
  subjectId: string;
  subjectName: string;
  alreadyEnrolled?: boolean;
}) {
  const [step, setStep] = useState<Step>("intro");

  if (step === "capture") {
    return (
      <div className="max-w-reading mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-fg">Position your face in the frame</h2>
            <p className="text-sm text-muted">Good lighting, look at the camera, then capture. We&apos;ll take two quick frames.</p>
          </div>
          <button onClick={() => setStep("intro")} className="btn-ghost text-sm shrink-0">Back</button>
        </div>
        <FaceCapture
          subjectType="STAFF"
          subjectId={subjectId}
          subjectName={subjectName}
          simple
          onComplete={() => setStep("done")}
        />
      </div>
    );
  }

  if (step === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="max-w-reading mx-auto card p-8 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent mx-auto flex items-center justify-center mb-4" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="font-display text-xl text-fg">Face ID setup complete</h2>
        <p className="text-sm text-muted mt-2">Your face is now registered for attendance. You can re-run setup any time.</p>
        <button onClick={() => setStep("intro")} className="btn-primary mt-6">Done</button>
      </motion.div>
    );
  }

  // Intro — explains the value and, inline, the camera-permission requirement.
  return (
    <div className="max-w-reading mx-auto card p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/12 ring-1 ring-accent/25 text-accent mx-auto flex items-center justify-center mb-5" aria-hidden>
        <FaceIdGlyph />
      </div>
      <h2 className="font-display text-2xl text-fg">Set up your Face ID</h2>
      <p className="text-sm text-muted mt-2 max-w-md mx-auto">
        Register your face once for faster, secure attendance check-in. Your face
        never leaves the server — it&apos;s encrypted and used only to verify you.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-elevated/50 p-4 text-left flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-accent/12 text-accent flex items-center justify-center shrink-0" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="13" r="4" /></svg>
        </span>
        <div>
          <div className="text-sm font-medium text-fg">Camera access is required</div>
          <div className="text-xs text-muted mt-0.5">
            Your browser will ask for permission when you start. Nothing is recorded until you capture.
          </div>
        </div>
      </div>

      <button onClick={() => setStep("capture")} className="btn-primary mt-6 w-full sm:w-auto sm:px-8">
        {alreadyEnrolled ? "Re-run Face setup" : "Start Face setup"}
      </button>
    </div>
  );
}
