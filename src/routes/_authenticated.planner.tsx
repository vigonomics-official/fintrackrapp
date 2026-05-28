import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Landmark, CalendarClock, BellRing, ShoppingBag, ChevronRight, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { CanIBuyThisDialog } from "@/components/finance/CanIBuyThisDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({ component: PlannerPage });

type Item = {
  label: string;
  description: string;
  icon: typeof Landmark;
  to?: string;
  onClick?: () => void;
  tone: string;
};

function PlannerPage() {
  const [cibtOpen, setCibtOpen] = useState(false);

  const items: Item[] = [
    {
      label: "Loans & EMI",
      description: "Track EMIs, due dates and pressure on your salary.",
      icon: Landmark,
      to: "/loans",
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Salary Countdown",
      description: "Days till next salary and your safe daily spend.",
      icon: CalendarClock,
      to: "/dashboard",
      tone: "bg-success/10 text-success",
    },
    {
      label: "Bill Reminders",
      description: "Upcoming bills and recurring payments.",
      icon: BellRing,
      to: "/loans",
      tone: "bg-gold/15 text-gold-foreground",
    },
    {
      label: "Goals",
      description: "Save for what matters most.",
      icon: Target,
      to: "/goals",
      tone: "bg-accent/40 text-foreground",
    },
    {
      label: "Can I Buy This?",
      description: "Check if a purchase fits your survival budget.",
      icon: ShoppingBag,
      onClick: () => setCibtOpen(true),
      tone: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Planner" subtitle="Plan your month, survive till salary." />

      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        {items.map((item) => {
          const Icon = item.icon;
          const inner = (
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
          );
          return item.to ? (
            <Link key={item.label} to={item.to} preload="intent">{inner}</Link>
          ) : (
            <button key={item.label} type="button" onClick={item.onClick} className="block w-full text-left">
              {inner}
            </button>
          );
        })}
      </div>

      <CanIBuyThisDialog open={cibtOpen} onOpenChange={setCibtOpen} />
    </div>
  );
}
