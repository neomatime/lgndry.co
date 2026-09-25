export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {description ? <p className="text-ink-muted mt-1.5 text-sm">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
