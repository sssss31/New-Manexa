"use client";

// Root-level error boundary — catches errors that escape the layout itself
// (page-level errors are handled by app/error.tsx). Must render its own
// <html>/<body>. The `digest` lets you correlate the user's screen with the
// full server stack trace in the platform logs (Vercel → Functions).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 32, maxWidth: 440 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h2>
          <p style={{ color: "#BDBDBD", fontSize: 14, marginTop: 8 }}>
            The error was logged{error.digest ? ` (ref ${error.digest})` : ""}. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              borderRadius: 12,
              border: "1px solid rgba(182,255,42,0.6)",
              background: "#000",
              color: "#B6FF2A",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
