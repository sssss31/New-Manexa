"use client";

// Shared route-level error boundary body. Each role segment's `error.tsx` wraps
// this so a failure inside one portal is recovered in place — the shell, sidebar
// and session stay mounted — instead of falling through to the app-wide
// `app/error.tsx`. `app/global-error.tsx` remains the last resort for failures
// that escape the root layout itself.
import Link from "next/link";

export function RouteError({
  error,
  reset,
  scope,
  home,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Human label for the portal, e.g. "institution dashboard". */
  scope: string;
  /** Where "Back to <portal>" should land. */
  home: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="card p-8 max-w-md w-full text-center animate-pop">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-fg">Couldn&apos;t load the {scope}</h2>
        <p className="text-sm text-muted mt-2">
          The error was logged{error.digest ? ` (ref ${error.digest})` : ""}. Retrying reloads just
          this section — you stay signed in.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href={home} className="btn-secondary">
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
