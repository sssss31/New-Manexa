# MANEXA — Dashboard Rules

"No plain numbers." Every important metric is represented **visually**.

## Layout order (institution & platform dashboards)
1. `PageHeader` — greeting/title + primary action.
2. **KPI row** — 4 `MetricCard`s (`grid-cols-2 md:grid-cols-4 gap-3`): value + delta
   trend + optional inline sparkline. Tone: accent for the hero metric, neutral rest.
3. **Visual analytics row** — charts from `@/components/charts`:
   - Trend over time → `AreaChart` (attendance %, admissions, revenue).
   - Composition → `DonutChart` (fee mix, pass/fail).
   - Comparison → `BarChart` (class strength, dept stats).
   - Single ratio → `ProgressRing` (enrolment %, attendance today).
4. **Two-column detail** — live sessions / activity feed / upcoming events (left,
   `lg:col-span-2`) + recent notices / recognition feed (right).
5. **Decision breakdown / quick actions** at the bottom.

## Chart styling (locked to brand)
- Black/transparent background, **neon-green highlights**, white/border grid
  (dashed, subtle), minimal labels, `tabular-nums`. This is already how
  `components/Charts.tsx` renders — reuse it, don't restyle.
- One accent series per chart; supporting series use `success`/`warning`/`muted`.

## Data
- Aggregate in the RSC page (`Promise.all`), pass plain arrays to chart components.
- Guard empty states ("Not enough data yet"). Never render an empty axis.
- Numbers formatted with `inr()` / `toLocaleString("en-IN")` and `tabular-nums`.

## Cards to reuse
`MetricCard` (stat + delta + sparkline slot), `SectionCard` (titled container),
`Stat` (compact), activity feed = `SectionCard` + list, timeline = bordered list with
`relative()` timestamps.
