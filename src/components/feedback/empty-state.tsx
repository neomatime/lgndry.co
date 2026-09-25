export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border-line border border-dashed px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {children ? <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm">{children}</p> : null}
    </div>
  );
}
