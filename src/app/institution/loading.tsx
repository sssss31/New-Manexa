// Premium dashboard skeleton — mirrors the cockpit layout so there's no layout
// shift when data arrives.
export default function Loading() {
  return (
    <div className="relative animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="h-5 w-24 rounded-full bg-fg/[0.06] mb-3" />
          <div className="h-9 w-72 rounded-xl bg-fg/[0.06]" />
          <div className="h-4 w-56 rounded-lg bg-fg/[0.04] mt-2" />
        </div>
        <div className="hidden sm:flex gap-2">
          <div className="h-9 w-20 rounded-xl bg-fg/[0.05]" />
          <div className="h-9 w-28 rounded-xl bg-fg/[0.05]" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-28" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-28" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="glass-panel h-64 lg:col-span-2" />
        <div className="glass-panel h-64" />
      </div>
      <div className="glass-panel h-56 mb-4" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel h-72 lg:col-span-2" />
        <div className="glass-panel h-72" />
      </div>
    </div>
  );
}
