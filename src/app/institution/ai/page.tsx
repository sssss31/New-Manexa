import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { attendanceTrend, defaulterForecast, riskReport } from "@/lib/ai";
import { PageHeader, SectionCard, Stat, Tag } from "@/components/ui";
import { inr } from "@/lib/format";

export default async function AiInsightsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [risks, defaulters, trend] = await Promise.all([
    riskReport(tenantId, 12),
    defaulterForecast(tenantId, 10),
    attendanceTrend(tenantId),
  ]);
  const high = risks.filter((r) => r.band === "HIGH").length;
  const medium = risks.filter((r) => r.band === "MEDIUM").length;

  return (
    <>
      <PageHeader
        title="AI Insights"
        sub="Explainable heuristics over live data — every score shows its reasons. Model backend pluggable per SAD §12.4."
        actions={<Link href="/institution/assistant" className="btn-primary">Ask the assistant</Link>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="High risk" value={high} tone={high ? "error" : "success"} sub="Composite score > 0.45" />
        <Stat label="Medium risk" value={medium} tone={medium ? "warning" : "success"} />
        <Stat label="Attendance trend" value={`${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct} pts`} tone={trend.deltaPct >= 0 ? "success" : "warning"} sub={`${trend.prev7Pct}% → ${trend.last7Pct}%`} />
        <Stat label="Tomorrow forecast" value={`${trend.forecastTomorrowPct}%`} sub="3-day moving average" />
      </div>

      <SectionCard title="Students at risk — ranked by composite score" className="mb-4">
        <div className="text-xs text-muted mb-3">
          Weights: attendance 45% · academics 35% · fee stress 20%. Bands: HIGH &gt; 0.45, MEDIUM &gt; 0.28.
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="th">Student</th>
                <th className="th">Class</th>
                <th className="th">Attendance</th>
                <th className="th">Avg score</th>
                <th className="th">Dues</th>
                <th className="th">Score</th>
                <th className="th">Why</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.studentId} className="row-hover align-top">
                  <td className="td">
                    <Link href={`/institution/students/${r.studentId}`} className="font-medium text-fg hover:text-accent">{r.name}</Link>
                  </td>
                  <td className="td text-muted">{r.className}</td>
                  <td className="td tabular-nums">{r.attendancePct}%</td>
                  <td className="td tabular-nums">{r.avgMarkPct}%</td>
                  <td className="td tabular-nums">{r.duesInr ? inr(r.duesInr) : "—"}</td>
                  <td className="td">
                    <Tag tone={r.band === "HIGH" ? "warning" : r.band === "MEDIUM" ? "muted" : "success"}>
                      {r.score} · {r.band}
                    </Tag>
                  </td>
                  <td className="td">
                    <ul className="text-xs text-muted space-y-0.5">
                      {r.reasons.map((reason, i) => <li key={i}>· {reason}</li>)}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Fee-default forecast">
        {defaulters.length === 0 && <div className="text-sm text-muted">No elevated default probabilities right now.</div>}
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr>
                <th className="th">Family / student</th>
                <th className="th">Class</th>
                <th className="th">Open dues</th>
                <th className="th">Overdue invoices</th>
                <th className="th">Historic lateness</th>
                <th className="th">P(default)</th>
              </tr>
            </thead>
            <tbody>
              {defaulters.map((d) => (
                <tr key={d.studentId} className="row-hover">
                  <td className="td font-medium">{d.name}</td>
                  <td className="td text-muted">{d.className}</td>
                  <td className="td tabular-nums">{inr(d.openDuesInr)}</td>
                  <td className="td tabular-nums">{d.overdueCount}</td>
                  <td className="td tabular-nums">{Math.round(d.latePaymentRatio * 100)}%</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${d.probability * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-xs">{Math.round(d.probability * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
