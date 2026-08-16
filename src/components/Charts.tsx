// Dependency-free, CSP-safe SVG charts on the MANEXA palette (neon on black,
// white grid, minimal labels). Server-renderable — no client JS required.

const ACCENT = "rgb(var(--accent))";
const GRID = "rgb(var(--border))";
const MUTED = "rgb(var(--muted))";

// ---- Area / line chart ----
export function AreaChart({
  data,
  height = 160,
  suffix = "",
  labels,
}: {
  data: number[];
  height?: number;
  suffix?: string;
  labels?: string[];
}) {
  const w = 560;
  const h = height;
  const pad = 24;
  const max = Math.max(1, ...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id="mnx-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#mnx-area)" />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 0} fill={ACCENT} />
      ))}
      <text x={pad} y={14} fill={MUTED} fontSize="11">{max}{suffix}</text>
      {labels && (
        <>
          <text x={pad} y={h - 6} fill={MUTED} fontSize="10">{labels[0]}</text>
          <text x={w - pad} y={h - 6} fill={MUTED} fontSize="10" textAnchor="end">{labels[labels.length - 1]}</text>
        </>
      )}
    </svg>
  );
}

// ---- Bar chart ----
export function BarChart({ data, height = 160, suffix = "" }: { data: { label: string; value: number }[]; height?: number; suffix?: string }) {
  const w = 560;
  const h = height;
  const pad = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (w - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - pad * 2);
        const x = pad + i * bw + bw * 0.18;
        const y = h - pad - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.64} height={bh} rx="4" fill={ACCENT} fillOpacity={0.85} />
            <text x={x + bw * 0.32} y={h - 8} fill={MUTED} fontSize="10" textAnchor="middle">{d.label}</text>
            <text x={x + bw * 0.32} y={y - 4} fill={MUTED} fontSize="10" textAnchor="middle">{d.value}{suffix}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- Donut chart ----
export function DonutChart({ segments, size = 168, centerLabel, centerSub }: {
  segments: { label: string; value: number; tone?: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 14;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const tones = [ACCENT, "rgb(var(--success))", "rgb(var(--warning))", MUTED, "rgb(var(--error))"];
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0" role="img" aria-label="Donut chart">
        <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth="14" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circ;
          const el = (
            <circle
              key={i}
              cx={c} cy={c} r={r} fill="none"
              stroke={s.tone ?? tones[i % tones.length]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        {centerLabel && <text x={c} y={c - 2} fill="rgb(var(--fg))" fontSize="20" fontWeight="600" textAnchor="middle">{centerLabel}</text>}
        {centerSub && <text x={c} y={c + 16} fill={MUTED} fontSize="10" textAnchor="middle">{centerSub}</text>}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.tone ?? tones[i % tones.length] }} />
            <span className="text-muted">{s.label}</span>
            <span className="text-fg font-mono ml-auto tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Progress ring ----
export function ProgressRing({ pct, size = 120, label }: { pct: number; size?: number; label?: string }) {
  const r = size / 2 - 10;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${pct}%`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth="9" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={ACCENT} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c - 1} fill="rgb(var(--fg))" fontSize="22" fontWeight="600" textAnchor="middle">{pct}%</text>
      {label && <text x={c} y={c + 17} fill={MUTED} fontSize="10" textAnchor="middle">{label}</text>}
    </svg>
  );
}
