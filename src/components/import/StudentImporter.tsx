"use client";

// Student bulk-import flow: drag-drop → server parse/validate → preview →
// commit. File parsing + import happen server-side; this component orchestrates
// the steps and renders progress + a full result report.

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

type Preview = {
  fileName: string;
  total: number;
  ready: Record<string, unknown>[];
  readyCount: number;
  invalid: { row: number; name: string; reasons: string }[];
  invalidCount: number;
  mappedColumns: string[];
  unmappedColumns: string[];
};
type Result = {
  imported: number;
  skipped: number;
  failed: number;
  createdClasses: string[];
  failures: { row: number; name: string; reason: string }[];
  created: { name: string; type: string; manexaId: string; status: "Created" }[];
};

export function StudentImporter() {
  const [stage, setStage] = useState<"upload" | "preview" | "done">("upload");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/institution/import/students/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not read the file"); return; }
      setPreview(data);
      setStage("preview");
    } catch {
      toast.error("Upload failed — please try again");
    } finally {
      setBusy(false);
    }
  }, []);

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/institution/import/students/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: preview.ready }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed"); return; }
      setResult(data);
      setStage("done");
      toast.success(`${data.imported} students imported`);
    } catch {
      toast.error("Import failed — please try again");
    } finally {
      setBusy(false);
    }
  }

  function reset() { setPreview(null); setResult(null); setStage("upload"); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Upload an Excel (.xlsx) or CSV file. We auto-map columns, validate, and skip duplicates.</p>
        <a href="/api/institution/import/students/template" className="btn-secondary text-xs whitespace-nowrap">↓ Download template</a>
      </div>

      <AnimatePresence mode="wait">
        {stage === "upload" && (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) parse(f); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${drag ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" /></svg>
              </div>
              <div>
                <div className="font-medium text-fg">{busy ? "Reading your file…" : "Drop your file here, or click to browse"}</div>
                <div className="mt-1 text-xs text-muted">.xlsx or .csv · up to 25,000 rows · max 8MB</div>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); }} />
            </label>
          </motion.div>
        )}

        {stage === "preview" && preview && (
          <motion.div key="pv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="Total rows" value={preview.total} />
              <Tile label="Ready to import" value={preview.readyCount} tone="success" />
              <Tile label="Invalid" value={preview.invalidCount} tone={preview.invalidCount ? "error" : "default"} />
            </div>

            {preview.unmappedColumns.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/[0.07] p-3 text-xs text-muted">
                Ignored columns (no match): <span className="text-fg">{preview.unmappedColumns.join(", ")}</span>
              </div>
            )}

            {preview.invalid.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-error">
                  {preview.invalidCount} rows will be skipped
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.invalid.slice(0, 50).map((iv) => (
                        <tr key={iv.row} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2 text-muted w-16">Row {iv.row}</td>
                          <td className="px-2 py-2 text-fg">{iv.name}</td>
                          <td className="px-4 py-2 text-error text-xs">{iv.reasons}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary flex-1" disabled={busy}>Cancel</button>
              <button onClick={commit} className="btn-primary flex-1" disabled={busy || preview.readyCount === 0}>
                {busy ? "Importing…" : `Import ${preview.readyCount} students`}
              </button>
            </div>
          </motion.div>
        )}

        {stage === "done" && result && (
          <motion.div key="dn" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="text-lg font-semibold text-fg">Import complete</div>
              <div className="text-sm text-muted">{result.imported} students added to your institution.</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Imported" value={result.imported} tone="success" />
              <Tile label="Skipped (dupes)" value={result.skipped} />
              <Tile label="Failed" value={result.failed} tone={result.failed ? "error" : "default"} />
            </div>
            {result.createdClasses.length > 0 && (
              <p className="text-xs text-muted">Auto-created classes: <span className="text-fg">{[...new Set(result.createdClasses)].join(", ")}</span></p>
            )}
            {result.created?.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Generated MANEXA IDs</div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-2 py-2 font-medium">Type</th>
                        <th className="px-2 py-2 font-medium">MANEXA ID</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.slice(0, 200).map((c, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2 text-fg">{c.name}</td>
                          <td className="px-2 py-2 text-muted">{c.type}</td>
                          <td className="px-2 py-2 font-mono text-xs text-accent">{c.manexaId}</td>
                          <td className="px-4 py-2"><span className="badge badge-success">{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.failures.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-error">Failures</div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {result.failures.slice(0, 50).map((f, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2 text-muted w-16">Row {f.row}</td>
                          <td className="px-2 py-2 text-fg">{f.name}</td>
                          <td className="px-4 py-2 text-error text-xs">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={reset} className="btn-secondary w-full">Import another file</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "error" }) {
  const c = tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-fg";
  return (
    <div className="rounded-xl border border-border bg-elevated/40 p-3">
      <div className={`text-2xl font-semibold ${c}`}>{value.toLocaleString()}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
