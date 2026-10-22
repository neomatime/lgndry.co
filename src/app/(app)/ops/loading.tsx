function Skeleton({ className }: { className: string }) {
  return <div className={`ops-skeleton bg-line/70 rounded-[var(--ops-radius-sm)] ${className}`} />;
}

export default function OpsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-5" aria-label="Loading Command Center">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72 max-w-[70vw]" />
          <Skeleton className="h-4 w-96 max-w-[80vw]" />
        </div>
        <Skeleton className="hidden h-9 w-36 sm:block" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-36" />
      <div className="grid gap-3 xl:grid-cols-12">
        <Skeleton className="h-64 xl:col-span-5" />
        <Skeleton className="h-64 xl:col-span-4" />
        <Skeleton className="h-64 xl:col-span-3" />
      </div>
    </div>
  );
}
