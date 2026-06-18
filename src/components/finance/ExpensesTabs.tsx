import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/categories", label: "Categories" },
] as const;

export function ExpensesTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="sticky top-0 z-10 border-b bg-card/80 px-4 backdrop-blur md:px-10">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = path === t.to || path.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
