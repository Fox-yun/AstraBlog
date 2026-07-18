export default function Loading() {
  return (
    <div className="max-w-2xl py-6 w-full" aria-live="polite" aria-busy="true">
      <div className="h-8 w-36 bg-bg-surface mb-12 animate-pulse" />
      <div className="space-y-8">
        {["01", "02", "03"].map((item) => (
          <div key={item} className="border-b border-border-base pb-6 space-y-3">
            <div className="h-3 w-16 bg-bg-surface animate-pulse" />
            <div className="h-4 w-3/4 bg-bg-surface animate-pulse" />
            <div className="h-3 w-1/3 bg-bg-surface animate-pulse" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading content</span>
    </div>
  );
}
