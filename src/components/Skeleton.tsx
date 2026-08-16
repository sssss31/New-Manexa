export function PortalSkeleton() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-64 mb-2" />
      <div className="skeleton h-4 w-96 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="skeleton h-72 lg:col-span-2" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
