import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";
import { Panel } from "./Panel";
import type { InstitutionHealth, HealthBand } from "@/lib/health";

// Band → semantic token (colours the gauge + labels). Kept as CSS-var tokens so
// it respects the theme; no hardcoded hex.
const BAND: Record<HealthBand, { token: string; text: string; label: string }> = {
  excellent: { token: "--success", text: "text-success", label: "Excellent" },
  good: { token: "--accent", text: "text-accent", label: "Healthy" },
  fair: { token: "--warning", text: "text-warning", label: "Fair" },
  attention: { token: "--error", text: "text-error", label: "Needs attention" },
};

function dimToken(score: number | null): string {
  if (score === null) return "--muted";
  if (score >= 85) return "--success";
  if (score >= 70) return "--accent";
  if (score >= 55) return "--warning";
  return "--error";
}

function Gauge({ value, band }: { value: number; band: HealthBand }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  const stroke = `rgb(var(${BAND[band].token}))`;
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="10" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-fg leading-none">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-subtle mt-1">/ 100</span>
      </div>
    </div>
  );
}

export function HealthScore({ health }: { health: InstitutionHealth }) {
  const band = BAND[health.band];
  return (
    <Panel
      title="Institution health"
      icon={<Activity size={15} />}
      right={<span className="text-xs text-subtle">AI-scored · live</span>}
    >
      <div className="grid gap-6 md:grid-cols-[auto_1fr] items-center">
        {/* Gauge + band */}
        <div className="flex flex-col items-center gap-2">
          <Gauge value={health.overall} band={health.band} />
          <span className={`badge ${band.text} bg-white/[0.04] border-white/10`}>{band.label}</span>
        </div>

        {/* Dimension bars */}
        <div className="space-y-3 min-w-0">
          {health.dimensions.map((d) => {
            const token = dimToken(d.score);
            return (
              <div key={d.key}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm text-fg">{d.label}</span>
                  <span className="text-xs tabular-nums" style={{ color: `rgb(var(${token}))` }}>
                    {d.score === null ? "—" : `${d.score}%`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${d.score ?? 0}%`, backgroundColor: `rgb(var(${token}))` }}
                  />
                </div>
                <div className="text-[11px] text-subtle mt-1">{d.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI recommendations */}
      {health.suggestions.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/8">
          <div className="section-h mb-2">What needs your attention</div>
          <ul className="space-y-1.5">
            {health.suggestions.map((s, i) => {
              const tone =
                s.tone === "error" ? "text-error" : s.tone === "warning" ? "text-warning" : "text-info";
              const body = (
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tone.replace("text-", "bg-")}`} />
                  <span className="text-sm text-muted">{s.text}</span>
                  {s.href && <ArrowUpRight size={14} className="mt-0.5 ml-auto shrink-0 text-subtle" />}
                </div>
              );
              return (
                <li key={i} className="rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
                  {s.href ? <Link href={s.href}>{body}</Link> : body}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
