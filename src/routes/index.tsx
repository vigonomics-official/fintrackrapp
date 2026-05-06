import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, PiggyBank, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Feature({ icon: Icon, title, desc }: { icon: typeof Wallet; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-2xl p-6 shadow-soft"
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </motion.div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,oklch(0.78_0.12_85),transparent_40%)]" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-gold text-gold-foreground">₣</div>
            FinTrackr
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" className="text-primary-foreground hover:bg-white/10">Sign in</Button></Link>
            <Link to="/signup"><Button className="bg-gradient-gold text-gold-foreground hover:opacity-90">Get started</Button></Link>
          </div>
        </nav>

        <div className="relative mx-auto max-w-6xl px-6 pb-32 pt-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Premium personal finance, reimagined
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Master your money,<br />
              <span className="bg-gradient-gold bg-clip-text text-transparent">effortlessly.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/80">
              Track every expense, set smart budgets, hit your savings goals — all in a beautifully simple dashboard.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-gold text-gold-foreground shadow-glow hover:opacity-90">
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-primary-foreground hover:bg-white/10">
                  I have an account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold">Everything you need.</h2>
          <p className="mt-3 text-muted-foreground">Built for clarity. Designed for delight.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={Wallet} title="Smart transactions" desc="Add income, expenses & transfers in seconds with categories, tags and notes." />
          <Feature icon={BarChart3} title="Beautiful insights" desc="Spending breakdowns, monthly trends, and category analysis at a glance." />
          <Feature icon={PiggyBank} title="Budgets that work" desc="Set monthly limits per category. Visual progress and gentle alerts." />
          <Feature icon={Sparkles} title="CSV import & export" desc="Bring your data in, take it with you. Your finances, always portable." />
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} FinTrackr · Crafted with care
      </footer>
    </div>
  );
}
