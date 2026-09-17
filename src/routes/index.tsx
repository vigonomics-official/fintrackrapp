import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Wallet,
  TrendingDown,
  CalendarClock,
  ShieldCheck,
  Sparkles,
  Zap,
  ShoppingCart,
  Landmark,
  Smartphone as PhoneIcon,
  Home,
  TrendingUp,
  Repeat,
  Utensils,
  Fuel,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "FinTrackr — Know exactly where your ₹ goes" },
      {
        name: "description",
        content:
          "FinTrackr is an intelligent money control center built for Indian salary life. Track UPI spends, set budgets, and beat month-end stress.",
      },
      { property: "og:title", content: "FinTrackr — Know exactly where your ₹ goes" },
      {
        property: "og:description",
        content:
          "FinTrackr is an intelligent money control center built for Indian salary life. Track UPI spends, set budgets, and beat month-end stress.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "FinTrackr",
          url: "https://fintrackrapp.lovable.app/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "FinTrackr",
          url: "https://fintrackrapp.lovable.app/",
          logo: "https://fintrackrapp.lovable.app/favicon.ico",
        }),
      },
    ],
  }),
  component: Landing,
});

const BRAND = {
  primary: "#0F766E",
  accent: "#14B8A6",
  bg: "#F8FAFC",
  text: "#0F172A",
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold shadow-sm"
        style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
      >
        ₹
      </div>
      <span className="font-display text-lg font-bold tracking-tight" >
        FinTrackr
      </span>
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Logo />
        <div className="hidden items-center gap-7 md:flex">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="text-sm font-medium text-muted-foreground hover:text-foreground">How it Works</a>
          <a href="#final" className="text-sm font-medium text-muted-foreground hover:text-foreground">Get Started</a>
        </div>
      </nav>
    </header>
  );
}


function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="relative mx-auto mt-8 w-full max-w-[22rem] sm:max-w-sm"
    >
      {/* Soft gradient glow behind phone */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] blur-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(20,184,166,0.18))",
        }}
      />

      {/* Phone frame */}
      <div className="relative rounded-[2.2rem] border border-border bg-card p-3 shadow-[0_30px_70px_-25px_rgba(17,24,39,0.35)]">
        <div
          className="rounded-[1.7rem] p-5"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in oklab, var(--muted) 70%, var(--card)) 0%, var(--card) 45%, color-mix(in oklab, var(--primary) 12%, var(--card)) 100%)",
          }}
        >

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Good morning, Aarav</p>
              <p className="text-base font-semibold text-foreground">November Overview</p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
            >
              A
            </div>
          </div>

          {/* Salary countdown pill */}
          <div
            className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${BRAND.primary}, #2563EB)` }}
          >
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              <p className="text-[11px] font-medium opacity-90">Next salary in</p>
            </div>
            <p className="text-sm font-bold">5 days</p>
          </div>

          {/* Spending ring + remaining */}
          <div className="mt-5 flex items-center gap-5">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EEF2F7" strokeWidth="3.4" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke={BRAND.primary}
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: "68 100" }}
                  transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-medium text-muted-foreground">Spent</span>
                <span className="text-base font-bold text-foreground">68%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Salary Left</p>
              <p className="font-display text-3xl font-bold text-foreground">₹ 12,840</p>
              <p
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: BRAND.accent }}
              >
                <TrendingDown className="h-3 w-3" /> 18% under last month
              </p>
            </div>
          </div>

          {/* Smart insight */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-5 rounded-2xl border border-blue-100/70 bg-card/80 p-3 shadow-sm backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Smart insight
                </p>
                <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground">
                  Food spends are up <span className="font-bold">₹ 1,240</span> this week. Cook 2 nights to save ~₹ 800.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered blue-teal background */}
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[640px]"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 0%, rgba(37,99,235,0.14) 0%, rgba(20,184,166,0.08) 45%, rgba(249,250,251,0) 80%)",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-32 -z-10 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-48 -z-10 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />

      <div className="mx-auto max-w-6xl px-5 pb-6 pt-10 text-center md:pt-14">
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
        >
          <Sparkles className="h-3 w-3" style={{ color: BRAND.primary }} />
          Built for Indian salary life
        </motion.span>

        <h1
          className="mx-auto mt-5 max-w-3xl font-display text-[2.1rem] font-bold leading-[1.1] tracking-tight text-foreground md:text-6xl"
        >
          Know exactly where your{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})`,
            }}
          >
            salary
          </span>{" "}
          goes.
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg"
        >
          Track expenses, plan your salary, and know how much you can safely spend — all in one simple dashboard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 flex justify-center"
        >
          <Link to="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full rounded-xl px-6 text-white shadow-md transition-transform hover:-translate-y-0.5 hover:opacity-95 sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${BRAND.primary}, #2563EB)`,
                boxShadow: "0 18px 40px -16px rgba(37,99,235,0.55)",
              }}
            >
              Start Tracking Free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Trust line */}
        <div className="mt-5 flex justify-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground md:text-xs">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
            No bank login required <span className="text-border">•</span> Privacy-first
          </p>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}


function SalaryLeftSection() {
  const metrics = [
    {
      icon: Wallet,
      title: "Salary Left",
      desc: "Exactly how much of your salary is left to spend right now.",
    },
    {
      icon: Zap,
      title: "Safe Daily Spend",
      desc: "A daily number you can spend and still make it comfortably to payday.",
    },
    {
      icon: CalendarClock,
      title: "Days Until Salary",
      desc: "Know your runway, so month-end never catches you by surprise.",
    },
  ];
  return (
    <section id="salary-left" className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Know what you can actually spend.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          FinTrackr turns your salary into three simple numbers — updated live as you spend.
        </p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {metrics.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
            >
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{it.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function AppScreens() {
  const expenses = [
    { icon: Utensils, name: "Swiggy", tag: "Food · UPI", amt: 340 },
    { icon: Fuel, name: "HP Petrol", tag: "Fuel · Card", amt: 1200 },
    { icon: PhoneIcon, name: "Jio Recharge", tag: "Bills · UPI", amt: 299 },
  ];
  const allocation = [
    { label: "Needs", pct: 50, color: BRAND.primary },
    { label: "Wants", pct: 30, color: BRAND.accent },
    { label: "Savings", pct: 20, color: "#2563EB" },
  ];
  const insights = [
    { icon: Sparkles, text: "Food up ₹1,240 this week — cook 2 nights to save ~₹800." },
    { icon: Repeat, text: "Netflix renews in 3 days · ₹649" },
    { icon: TrendingUp, text: "You're spending 12% less than last month." },
  ];
  const cardCls = "rounded-3xl border border-border bg-card p-5 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]";

  return (
    <section id="dashboard" className="relative overflow-hidden py-10 md:py-14">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(20,184,166,0.10), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3 w-3" style={{ color: BRAND.primary }} /> Inside FinTrackr
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-foreground md:text-3xl">
            Your salary, under control
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            See your Salary Left, Safe Daily Spend, upcoming bills and spending at a glance.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Home — larger, featured */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`lg:col-span-2 ${cardCls}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Home</p>
              <span className="text-[10px] text-muted-foreground">November</span>
            </div>
            <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <div className="relative mx-auto h-36 w-36 shrink-0">
                <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EEF2F7" strokeWidth="3.5" />
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke={BRAND.primary}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    whileInView={{ strokeDasharray: "72 100" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-medium text-muted-foreground">Spent</span>
                  <span className="font-display text-lg font-bold text-foreground">72%</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs text-muted-foreground">Salary Left</p>
                <p className="font-display text-4xl font-bold text-foreground">₹ 9,441</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <CalendarClock className="h-3 w-3" /> Salary in 5 days
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
                  >
                    <Zap className="h-3 w-3" /> Safe Daily Spend ₹ 428
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Expenses */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className={cardCls}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Expenses</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Auto-categorized
              </span>
            </div>
            <div className="mt-3 divide-y divide-border">
              {expenses.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
                    >
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{t.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{t.tag}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs font-bold text-foreground">− ₹ {t.amt.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Planner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={cardCls}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Planner</p>
            <div className="mt-4 space-y-3">
              {allocation.map((a, i) => (
                <div key={a.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{a.label}</span>
                    <span className="font-semibold text-foreground">{a.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${a.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: a.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
              <Landmark className="h-4 w-4 shrink-0" style={{ color: BRAND.primary }} />
              <p className="text-[11px] font-medium text-muted-foreground">EMIs, bills and goals planned for the month</p>
            </div>
          </motion.div>

          {/* Insights */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl p-5 text-white shadow-[0_20px_50px_-20px_rgba(37,99,235,0.45)] lg:col-span-2"
            style={{ background: `linear-gradient(135deg, ${BRAND.primary}, #2563EB)` }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest opacity-90">Insights</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {insights.map((it, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-card/10 p-4 backdrop-blur-sm ring-1 ring-white/15"
                >
                  <it.icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
                  <p className="text-xs leading-snug">{it.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const items = [
    { icon: Wallet, title: "Where did my salary go?", desc: "Gone by mid-month and you can't trace it." },
    { icon: ShoppingCart, title: "Can I afford this?", desc: "No clear answer before you tap Pay." },
    { icon: Zap, title: "How much can I spend today?", desc: "Guessing never ends well." },
    { icon: CalendarClock, title: "Will I have enough until salary day?", desc: "That quiet month-end worry, every month." },
    { icon: Landmark, title: "How will I manage my EMIs and bills?", desc: "Rent, EMIs, subscriptions — all landing at once." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-8 md:py-10">
      <h2 className="text-center font-display text-xl font-bold text-foreground md:text-2xl">Sound familiar?</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "rgba(20,184,166,0.10)", color: BRAND.accent }}
            >
              <it.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{it.title}</h3>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function BuiltForSalary() {
  const items = [
    { icon: Zap, title: "Know your safe daily spending", desc: "One clear number tells you what's safe to spend today." },
    { icon: CalendarClock, title: "Plan your monthly salary", desc: "Split your salary across needs, wants and savings." },
    { icon: Landmark, title: "Stay ahead of bills and EMIs", desc: "Recurring bills and EMIs are planned before they land." },
    { icon: TrendingUp, title: "Understand your spending", desc: "See where every rupee actually goes." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Built for your salary, not just your expenses
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          FinTrackr plans around your pay cycle — so your money lasts the full month.
        </p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
            >
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Add your salary", desc: "Set your salary and payday. Your month is built around it." },
    { n: "02", title: "Track your spending", desc: "Log expenses in seconds and see where your money goes." },
    { n: "03", title: "Know what you can safely spend", desc: "Get your Salary Left and Safe Daily Spend, updated live." },
  ];
  return (
    <section id="how" className="bg-card py-8 md:py-10">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">How it works</h2>
          <p className="mt-1 text-xs text-muted-foreground">Three steps. No spreadsheets.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 1, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  const items = [
    { icon: Landmark, title: "No bank login required.", desc: "FinTrackr never connects to your bank — you add your own data." },
    { icon: Lock, title: "No bank password required.", desc: "Nothing sensitive to hand over, nothing to leak." },
    { icon: ShieldCheck, title: "Your data belongs to you.", desc: "Stored privately in your own account. Export or delete it anytime." },
  ];
  return (
    <section className="bg-card py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Your money data stays yours</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tracking your money shouldn't mean handing over your bank.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-muted/40 p-5 text-center"
            >
              <div
                className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(20,184,166,0.12)", color: BRAND.accent }}
              >
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section
      id="final"
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(145deg, #2563EB 0%, #0F766E 55%, #14B8A6 100%)`,
      }}
    >
      {/* Soft radial glows for depth */}
      <div className="pointer-events-none absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-foreground/5 blur-[100px]" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-teal-300/[0.10] blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-300/[0.10] blur-[80px]" />

      <div className="relative mx-auto max-w-2xl px-5 py-14 text-center md:py-20">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-white md:text-5xl"
        >
          Start controlling your salary today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/90 md:text-base"
        >
          Know where your money goes. Know what you can spend.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/signup">
            <Button
              size="lg"
              className="rounded-xl bg-card px-7 text-sm font-semibold text-[#0F766E] shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-card/95"
              style={{ boxShadow: "0 20px 50px -15px rgba(0,0,0,0.25)" }}
            >
              Start Tracking Free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button
              size="lg"
              variant="ghost"
              className="rounded-xl px-7 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-card/10 hover:ring-white/40"
            >
              Sign In
            </Button>
          </Link>
        </motion.div>

        {/* Calm reassurance microcopy */}
        <motion.p
          initial={{ opacity: 1 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-4 text-xs font-medium text-white/90"
        >
          No credit card required · Takes 30 seconds
        </motion.p>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "How it Works", href: "#how" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Contact", href: "mailto:support@fintrackrapp.com" },
      ],
    },
  ];
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-xs text-muted-foreground">
            An intelligent money control center built for Indian salary life.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FinTrackr
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Made with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <SalaryLeftSection />
        <AppScreens />
        <ProblemSection />
        <BuiltForSalary />
        <HowItWorks />
        <PrivacySection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
