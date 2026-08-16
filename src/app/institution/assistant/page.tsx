import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { answerQuery } from "@/lib/ai";
import { PageHeader, SectionCard } from "@/components/ui";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const result = q ? await answerQuery(user.tenantId!, q) : null;

  const suggestions = result?.followups ?? [
    "Which students are at risk?",
    "Who is likely to default on fees?",
    "How is attendance trending?",
    "Who are the top performers?",
    "How many students per class?",
  ];

  return (
    <>
      <PageHeader
        title="AI Assistant"
        sub="Ask in plain English — answers computed live from your institution's data"
      />

      <SectionCard className="mb-4">
        <form method="get" className="flex gap-2">
          <input
            className="input flex-1 text-base"
            name="q"
            defaultValue={q ?? ""}
            placeholder='Try "which students are at risk?" or a student name…'
            autoFocus
            aria-label="Ask the assistant"
          />
          <button className="btn-primary">Ask</button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <Link key={s} href={`/institution/assistant?q=${encodeURIComponent(s)}`} className="badge badge-muted hover:border-accent/40 transition-colors">
              {s}
            </Link>
          ))}
        </div>
      </SectionCard>

      {result && (
        <SectionCard title={result.title} className="animate-pop">
          <p className="text-sm text-fg leading-relaxed">{result.text}</p>
          {result.table && result.table.rows.length > 0 && (
            <div className="overflow-x-auto mt-4 -mx-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>{result.table.columns.map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {result.table.rows.map((row, i) => (
                    <tr key={i} className="row-hover">
                      {row.map((cell, j) => (
                        <td key={j} className={`td ${typeof cell === "number" ? "tabular-nums" : ""}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs text-subtle">
            Deterministic heuristic engine over live tenant data. An LLM backend plugs into the same `answerQuery` interface.
          </div>
        </SectionCard>
      )}

      {!result && (
        <div className="card p-10 text-center">
          <div className="text-3xl mb-2">✦</div>
          <div className="text-fg font-medium">Ask anything about your institution</div>
          <div className="text-sm text-muted mt-1">Risk, fees, attendance, performance, enrolment — or search any student or lead by name.</div>
        </div>
      )}
    </>
  );
}
