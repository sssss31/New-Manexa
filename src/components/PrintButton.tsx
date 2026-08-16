"use client";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      {label}
    </button>
  );
}
