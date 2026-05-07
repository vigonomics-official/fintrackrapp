import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { TrendingUp, PieChart, Landmark, Sparkles, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/finance/PageHeader";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/investments")({ component: Investments });

function Investments() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "USD";

  const tiles = [
    { label: "Portfolio Value", value: formatCurrency(0, currency), icon: TrendingUp, accent: "bg-gradient-primary text-primary-foreground" },
    { label: "Today's Change", value: "—", icon: ArrowUpRight, accent: "bg-success text-success-foreground" },
    { label: "Holdings", value: "0", icon: PieChart, accent: "bg-gradient-gold text-gold-foreground" },
    { label: "Accounts", value: "0", icon: Landmark, accent: "bg-secondary text-secondary-foreground" },
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
              Connect your brokerage, mutual funds, stocks, crypto and gold holdings to see a unified
              portfolio view. We'll surface returns, asset allocation, and SIP performance here.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Stocks", "Mutual Funds", "ETFs", "Crypto", "Gold", "Fixed Deposits"].map((tag) => (
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
    </div>
  );
}
