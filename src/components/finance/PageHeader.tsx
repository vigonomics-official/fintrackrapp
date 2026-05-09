export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-card/40 px-5 py-4 backdrop-blur md:px-10 md:py-7">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
