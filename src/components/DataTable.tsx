"use client";

// Enterprise table: sticky header · sort · filter · CSV export · pagination ·
// bulk select. Rows are plain serializable objects; `_href` makes a row a link.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type Column = { key: string; label: string; numeric?: boolean };
export type Row = Record<string, string | number | null | undefined> & { _href?: string };

const PAGE_SIZE = 25;

export function DataTable({
  columns,
  rows,
  exportName = "export",
  searchPlaceholder = "Filter rows…",
}: {
  columns: Column[];
  rows: Row[];
  exportName?: string;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const router = useRouter();

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    let out = needle
      ? rows.filter((r) =>
          columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle))
        )
      : [...rows];
    if (sortKey) {
      out.sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
    }
    return out;
  }, [rows, columns, q, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  function exportCsv(onlySelected = false) {
    const source = onlySelected && selected.size
      ? filtered.filter((_, i) => selected.has(i))
      : filtered;
    const head = columns.map((c) => `"${c.label}"`).join(",");
    const body = source
      .map((r) => columns.map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const allPageSelected = pageRows.length > 0 && pageRows.every((_, i) => selected.has(page * PAGE_SIZE + i));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder={searchPlaceholder}
          className="input max-w-xs"
          aria-label="Filter table"
        />
        <div className="flex-1" />
        {selected.size > 0 && (
          <span className="text-xs text-accent">{selected.size} selected</span>
        )}
        <button onClick={() => exportCsv(true)} className="btn-secondary text-xs" disabled={selected.size === 0}>
          Export selected
        </button>
        <button onClick={() => exportCsv(false)} className="btn-primary text-xs">
          Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <th className="th w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  aria-label="Select page"
                  onChange={() => {
                    const next = new Set(selected);
                    pageRows.forEach((_, i) => {
                      const idx = page * PAGE_SIZE + i;
                      if (allPageSelected) next.delete(idx);
                      else next.add(idx);
                    });
                    setSelected(next);
                  }}
                />
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="th cursor-pointer select-none hover:text-fg transition-colors"
                  onClick={() => toggleSort(c.key)}
                  aria-sort={sortKey === c.key ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                >
                  {c.label}
                  {sortKey === c.key && <span className="text-accent ml-1">{sortDir === 1 ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td className="td text-muted text-center py-10" colSpan={columns.length + 1}>No rows match.</td></tr>
            )}
            {pageRows.map((r, i) => {
              const idx = page * PAGE_SIZE + i;
              return (
                <tr
                  key={idx}
                  className={`row-hover ${r._href ? "cursor-pointer" : ""}`}
                  onClick={() => r._href && router.push(r._href)}
                >
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      aria-label={`Select row ${idx + 1}`}
                      onChange={() => {
                        const next = new Set(selected);
                        next.has(idx) ? next.delete(idx) : next.add(idx);
                        setSelected(next);
                      }}
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={`td ${c.numeric ? "tabular-nums" : ""}`}>
                      {r[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted">
        <span>{filtered.length.toLocaleString()} rows</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="font-mono">{page + 1} / {pages}</span>
          <button className="btn-ghost text-xs" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
