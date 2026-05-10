import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, PieChart, Landmark, Sparkles, ArrowUpRight, Repeat, Coins, Briefcase, BarChart3, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/finance/PageHeader";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/investments")({ component: Investments });

function Investments() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "USD";
  const [fabSheet, setFabSheet] = useState(false);

  useEffect(() => {
    const h = () => setFabSheet(true);
    window.addEventListener("fintrackr:fab", h);
    return () => window.removeEventListener("fintrackr:fab", h);
  }, []);

  const tiles = [
    { label: "Portfolio Value", value: formatCurrency(0, currency), icon: TrendingUp, accent: "bg-gradient-primary text-primary-foreground" },
    { label: "Today's Change", value: "—", icon: ArrowUpRight, accent: "bg-success text-success-foreground" },
    { label: "Holdings", value: "0", icon: PieChart, accent: "bg-gradient-gold text-gold-foreground" },
    { label: "Accounts", value: "0", icon: Landmark, accent: "bg-secondary text-secondary-foreground" },
  ];

  const actions: { label: string; icon: typeof Plus; tone: string }[] = [
    { label: "Add SIP", icon: Repeat, tone: "bg-primary/10 text-primary" },
    { label: "Add Investment", icon: TrendingUp, tone: "bg-success/10 text-success" },
    { label: "Add Gold Investment", icon: Coins, tone: "bg-gold/15 text-gold-foreground" },
    { label: "Add Mutual Fund", icon: Briefcase, tone: "bg-info/15 text-info" },
    { label: "Add Stock Entry", icon: BarChart3, tone: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div>
      <PageHeader title="Investments" subtitle="Track your portfolio, holdings & returns." />
      <div className="space-y-6 px-6 py-6 md:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-soft">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.label}</p>
                    <p className="mt-2 font-display text-2xl font-bold">{t.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-elegant ${t.accent}`}>
                    <t.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-4 w-4 text-gold" /> Coming soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Track your mutual funds, stocks, SIPs, gold, and more in one unified portfolio. We'll surface returns, asset allocation, and SIP performance here.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Stocks", "Mutual Funds", "ETFs", "SIPs", "Gold", "Fixed Deposits"].map((tag) => (
                <span key={tag} className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            <div className="pt-2">
              <Button asChild variant="outline">
                <Link to="/menu">Configure investment settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={fabSheet} onOpenChange={setFabSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Investment actions</SheetTitle>
            <SheetDescription>Add new holdings to your portfolio.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {actions.map((a) => (
              <button key={a.label}
                onClick={() => { setFabSheet(false); toast.info(`${a.label} — coming soon`); }}
                className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft active:scale-[0.98]">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`}>
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
