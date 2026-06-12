import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, LineChart, MessageSquareText, Tag, ChevronRight, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights — FinTrackr" },
      { name: "description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
      { property: "og:title", content: "Insights — FinTrackr" },
      { property: "og:description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/insights" },
      { name: "twitter:title", content: "Insights — FinTrackr" },
      { name: "twitter:description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/insights" }],
  }),
});

const ITEMS = [
  {
    label: "AI Insights",
    description: "Smart guidance based on your spending.",
    icon: Sparkles,
    to: "/dashboard",
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Danger Alerts",
    description: "Low funds, EMI pressure & weekend risk.",
    icon: AlertTriangle,
    to: "/dashboard",
    tone: "bg-destructive/10 text-destructive",
  },
  {
    label: "Weekly Survival Report",
    description: "How your week went vs your safe limit.",
    icon: LineChart,
    to: "/reports",
    tone: "bg-success/10 text-success",
  },
  {
    label: "Spending Behavior",
    description: "Where your money quietly slips away.",
    icon: BarChart3,
    to: "/reports",
    tone: "bg-gold/15 text-gold-foreground",
  },
  {
    label: "SMS Intelligence",
    description: "Auto-detect UPI & SMS spends.",
    icon: MessageSquareText,
    to: "/sms-intelligence",
    tone: "bg-accent/40 text-foreground",
  },
  {
    label: "Smart Categorization",
    description: "Self-learning merchants & rules.",
    icon: Tag,
    to: "/smart-categorization",
    tone: "bg-primary/10 text-primary",
  },
] as const;

function InsightsPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Insights" subtitle="Your money, decoded." />

      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.to} preload="intent">
              <Card className="flex items-center gap-3 p-3.5 shadow-soft transition-colors hover:bg-muted/30">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", item.tone)}>
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
