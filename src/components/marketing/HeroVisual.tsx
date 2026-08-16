// Realistic product preview for the hero — a glass dashboard card built from the
// real chart components, ringed by floating "widget" cards. Server-rendered SVG;
// the float is pure CSS so no client JS is needed.
import { CalendarCheck, IndianRupee, Sparkles, TrendingUp, Users, Bell } from "lucide-react";
import { AreaChart, DonutChart, ProgressRing } from "@/components/Charts";

function FloatCard({
  className,
  icon,
  label,
  value,
  sub,
  anim = "mkt-float",
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  anim?: string;
}) {
  return (
    <div className={`absolute ${className} ${anim} hidden sm:block`}>
      <div className="mkt-glass-strong rounded-2xl px-4 py-3 shadow-2xl min-w-[150px]">
        <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wider">
          <span className="text-accent">{icon}</span>
          {label}
        </div>
        <div className="text-white font-semibold text-lg mt-1 tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-accent mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-3xl">
      {/* Glow behind the dashboard */}
      <div className="absolute -inset-8 mkt-orb mkt-orb-green rounded-[40px] opacity-40" aria-hidden />

      {/* Main dashboard card */}
      <div className="relative mkt-glass-strong rounded-[24px] p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-white/80 text-sm font-medium">St. John&apos;s Academy — Cockpit</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { icon: <Users size={14} />, k: "Students", v: "1,284" },
            { icon: <CalendarCheck size={14} />, k: "Attendance", v: "96%" },
            { icon: <IndianRupee size={14} />, k: "Collected", v: "₹4.2L" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
              <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase tracking-wider">
                <span className="text-accent">{s.icon}</span>{s.k}
              </div>
              <div className="text-white font-semibold text-lg mt-1 tabular-nums">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 rounded-xl bg-white/[0.03] border border-white/8 p-3">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Attendance trend</div>
            <AreaChart data={[88, 91, 89, 93, 90, 94, 96, 95, 97, 96]} suffix="%" height={120} />
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 flex flex-col items-center justify-center gap-2">
            <ProgressRing pct={82} size={96} label="Fees" />
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Collection</div>
          </div>
        </div>
      </div>

      {/* Floating widgets */}
      <FloatCard
        className="-top-6 -left-6 lg:-left-16"
        icon={<Sparkles size={13} />}
        label="AI Assistant"
        value="7 at-risk"
        sub="flagged this week"
      />
      <FloatCard
        className="top-1/3 -right-6 lg:-right-20"
        icon={<TrendingUp size={13} />}
        label="Performance"
        value="+12%"
        sub="term over term"
        anim="mkt-float-slow"
      />
      <FloatCard
        className="-bottom-6 left-4 lg:-left-12"
        icon={<Bell size={13} />}
        label="Parent alerts"
        value="342 sent"
        sub="attendance + fees"
        anim="mkt-float-slow"
      />
    </div>
  );
}
