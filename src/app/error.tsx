"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="card p-8 max-w-md w-full text-center animate-pop">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-fg">Something went wrong</h2>
        <p className="text-sm text-muted mt-2">
          The error was logged{error.digest ? ` (ref ${error.digest})` : ""}. Try again — if it persists, contact support.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
