import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
  showBack,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Renders a back control (for pages outside the app's bottom navigation). */
  showBack?: boolean;
}) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/" });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-card/40 px-4 py-4 backdrop-blur md:px-10 md:py-7">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground/80 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
