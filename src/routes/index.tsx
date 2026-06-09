import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  Wallet,
  TrendingDown,
  CalendarClock,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Cpu,
  Bell,
  Receipt,
  Sparkles,
  CheckCircle2,
  Zap,
  PieChart,
  Flame,
  FileDown,
  MessageSquare,
  Tags,
  Brain,
  Utensils,
  Fuel,
  Landmark,
  Smartphone as PhoneIcon,
  Home,
  TrendingUp,
  Repeat,
  Quote,
  Heart,
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
      <span className="font-display text-lg font-bold tracking-tight" style={{ color: BRAND.text }}>
        FinTrackr
      </span>
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Logo />
        <div className="hidden items-center gap-7 md:flex">
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Features</a>
          <a href="#how" className="text-sm font-medium text-gray-600 hover:text-gray-900">How it Works</a>
          <a href="#final" className="text-sm font-medium text-gray-600 hover:text-gray-900">Get Started</a>
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
      className="relative mx-auto mt-12 w-full max-w-sm"
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
      <div className="relative rounded-[2.2rem] border border-gray-200 bg-white p-3 shadow-[0_30px_70px_-25px_rgba(17,24,39,0.35)]">
        <div
          className="rounded-[1.7rem] p-5"
          style={{
            background:
              "linear-gradient(160deg, #F1F5F9 0%, #FFFFFF 45%, #ECFDF5 100%)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Good morning, Aarav</p>
              <p className="text-base font-semibold text-gray-900">November Overview</p>
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
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
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
                <span className="text-[10px] font-medium text-gray-500">Spent</span>
                <span className="text-base font-bold text-gray-900">68%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-medium text-gray-500">Remaining balance</p>
              <p className="font-display text-2xl font-bold text-gray-900">₹ 12,840</p>
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
            className="mt-5 rounded-2xl border border-blue-100/70 bg-white/80 p-3 shadow-sm backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Smart insight
                </p>
                <p className="mt-0.5 text-[12px] font-medium leading-snug text-gray-800">
                  Food spends are up <span className="font-bold">₹ 1,240</span> this week. Cook 2 nights to save ~₹ 800.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating accent cards */}
      <motion.div
        initial={{ opacity: 0, x: -16, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.7 }}
        className="absolute -left-4 top-28 hidden rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 sm:block"
      >
        <p className="text-[10px] text-gray-500">Saved this month</p>
        <p className="text-sm font-bold" style={{ color: BRAND.accent }}>+ ₹ 2,340</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 16, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.9 }}
        className="absolute -right-4 bottom-20 hidden rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 sm:block"
      >
        <p className="text-[10px] text-gray-500">Daily streak</p>
        <p className="text-sm font-bold text-gray-900">🔥 28 days</p>
      </motion.div>
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

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 text-center md:pt-20">
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-700 shadow-sm"
        >
          <Sparkles className="h-3 w-3" style={{ color: BRAND.primary }} />
          Built for Indian salary life
        </motion.span>

        <h1
          className="mx-auto mt-5 max-w-3xl font-display text-[2.1rem] font-bold leading-[1.1] tracking-tight text-gray-900 md:text-6xl"
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
          className="mx-auto mt-5 max-w-xl text-base text-gray-600 md:text-lg"
        >
          FinTrackr helps Indian salary earners track spending, manage budgets, and save more — without spreadsheets or confusion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-7 flex justify-center"
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
              Get Early Access <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Trust row */}
        <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-gray-500 md:text-xs">
          {["No bank login needed", "Built for India", "Setup in under 60 seconds"].map((t) => (
            <div key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
              {t}
            </div>
          ))}
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}


function TrustSection() {
  const items = [
    { icon: ShieldCheck, title: "Privacy-first finance tracking", desc: "Your data stays yours. No selling, no snooping." },
    { icon: Smartphone, title: "Built for UPI-first India", desc: "Designed for how you actually spend — PhonePe, GPay, Paytm." },
    { icon: Cpu, title: "Smart categorization on-device", desc: "Transactions sorted instantly, right on your phone." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
            >
              <it.icon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">{it.title}</h2>
            <p className="mt-1 text-xs text-gray-600">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ProblemSection() {
  const items = [
    { icon: Wallet, title: "Salary disappears quickly", desc: "Gone by the 15th. No idea where." },
    { icon: Receipt, title: "UPI spending confusion", desc: "₹50–₹200 spends silently drain you." },
    { icon: CalendarClock, title: "Month-end stress", desc: "Rent, EMIs, bills — barely anything left." },
    { icon: PiggyBank, title: "Don't know how to save", desc: "Want to, but don't know where to start." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-10 md:py-14">
      <h2 className="text-center font-display text-xl font-bold text-gray-900 md:text-2xl">Sound familiar?</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "rgba(20,184,166,0.10)", color: BRAND.accent }}
            >
              <it.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">{it.title}</h3>
            <p className="mt-1 text-[12px] leading-snug text-gray-500">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Zap, title: "Quick Expense Entry", desc: "Log a spend in under 3 seconds — amount, tap, done." },
    { icon: PieChart, title: "Spending Insights", desc: "See where your money flows with clean weekly and monthly breakdowns." },
    { icon: Bell, title: "Budget Alerts", desc: "Gentle nudges before you overshoot a category — no nasty surprises." },
    { icon: CalendarClock, title: "Salary Countdown", desc: "Always know how many days till your next paycheck and your runway." },
    { icon: Flame, title: "Daily Streak", desc: "Build a daily tracking habit. Watch your streak — and savings — grow." },
    { icon: FileDown, title: "CSV Export", desc: "Export every transaction in one tap. Your data, your file." },
    { icon: MessageSquare, title: "SMS Intelligence", desc: "Reads bank and UPI alerts automatically — no manual entry needed." },
    { icon: Tags, title: "Smart Categorization", desc: "Learns your habits and labels Swiggy, Uber, EMIs the right way." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">Your money, finally clear.</h2>
        <p className="mt-3 text-sm text-gray-600">
          Everything you need to take control of your salary, spends and savings — in one calm dashboard.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
            >
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{it.title}</h3>
            <p className="mt-1 text-xs text-gray-600">{it.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SmartFeatures() {
  const cards = [
    {
      icon: MessageSquare,
      title: "SMS Intelligence",
      desc: "Automatically detects bank and UPI transaction messages — so you don't have to type a thing.",
    },
    {
      icon: Tags,
      title: "Smart Categorization",
      desc: "Learns and categorizes your spending automatically — Swiggy is food, HP is fuel, HDFC is EMI.",
    },
    {
      icon: Brain,
      title: "Self-Learning Engine",
      desc: "The more you use FinTrackr, the smarter your expense tracking becomes. It adapts to your habits.",
    },
  ];
  const examples = [
    { icon: Utensils, from: "Swiggy", to: "Food" },
    { icon: Fuel, from: "HP Petrol", to: "Fuel" },
    { icon: Landmark, from: "EMI HDFC", to: "EMI" },
    { icon: PhoneIcon, from: "Recharge", to: "Utilities" },
  ];
  return (
    <section className="relative overflow-hidden bg-white py-14 md:py-20">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-72"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, rgba(37,99,235,0.07), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-700">
            <Brain className="h-3 w-3" style={{ color: BRAND.primary }} /> Smarter over time
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 md:text-4xl">
            Built to learn your habits.
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            FinTrackr reads your transaction messages and quietly organizes them — no setup, no spreadsheets.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-6 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
              >
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{c.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-gray-100 bg-gray-50/70 p-6 md:p-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500">
            How it learns
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {examples.map((ex, i) => (
              <motion.div
                key={ex.from}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
                  >
                    <ex.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{ex.from}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-gray-600" />
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: "rgba(20,184,166,0.12)", color: BRAND.accent }}
                  >
                    {ex.to}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardShowcase() {
  const categories = [
    { label: "Food & Dining", pct: 28, amt: 4640, color: "#0F766E" },
    { label: "Rent & EMI", pct: 32, amt: 5300, color: "#14B8A6" },
    { label: "Fuel & Travel", pct: 18, amt: 2980, color: "#6366F1" },
    { label: "Bills & Other", pct: 22, amt: 3640, color: "#F59E0B" },
  ];
  const txns = [
    { icon: Utensils, name: "Swiggy", tag: "Food · UPI", amt: 340 },
    { icon: Fuel, name: "HP Petrol", tag: "Fuel · Card", amt: 1200 },
    { icon: Home, name: "Rent", tag: "Housing · NEFT", amt: 8000 },
    { icon: PhoneIcon, name: "Jio Recharge", tag: "Bills · UPI", amt: 299 },
  ];
  const insights = [
    { icon: Sparkles, text: "Food orders up ₹1,240 this week. Cook 2 nights to save ~₹800." },
    { icon: Repeat, text: "Netflix renews in 3 days · ₹649" },
    { icon: TrendingUp, text: "You're spending 12% less than last month." },
  ];

  return (
    <section id="dashboard" className="relative overflow-hidden py-14 md:py-20">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(20,184,166,0.10), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-700 shadow-sm">
            <Sparkles className="h-3 w-3" style={{ color: BRAND.primary }} /> Inside FinTrackr
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 md:text-4xl">
            One calm dashboard for your whole salary.
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            A quiet control center — budgets, categories, transactions and gentle nudges. No noise, no spreadsheets.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:gap-5 lg:grid-cols-12">
          {/* Budget ring + salary countdown */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
          >
            <p className="text-xs font-medium text-gray-500">November · Budget</p>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
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
                  <span className="text-[10px] font-medium text-gray-500">Spent</span>
                  <span className="font-display text-lg font-bold text-gray-900">72%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="font-display text-3xl font-bold text-gray-900">₹ 9,441</p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CalendarClock className="h-3 w-3" /> Salary in 5 days
                </p>
              </div>
            </div>
          </motion.div>

          {/* Savings goal */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-7 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Savings goal · Goa trip</p>
                <p className="font-display text-2xl font-bold text-gray-900">
                  ₹ 38,200 <span className="text-sm font-medium text-gray-600">/ 50,000</span>
                </p>
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: "rgba(20,184,166,0.10)", color: BRAND.accent }}
              >
                <PiggyBank className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "76%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.accent})` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span>76% complete</span>
              <span>On track for Dec 18</span>
            </div>
          </motion.div>

          {/* Spending categories */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Spending by category</p>
              <span className="text-[10px] text-gray-600">This month</span>
            </div>
            <div className="mt-4 space-y-3.5">
              {categories.map((c, i) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-gray-700">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.label}
                    </span>
                    <span className="font-semibold text-gray-900">₹ {c.amt.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${c.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: c.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent transactions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-7 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Recent transactions</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <MessageSquare className="h-3 w-3" /> Auto from SMS
              </span>
            </div>
            <div className="mt-3 divide-y divide-gray-100">
              {txns.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: "rgba(37,99,235,0.08)", color: BRAND.primary }}
                    >
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                      <p className="text-[10px] text-gray-500">{t.tag}</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-gray-900">− ₹ {t.amt.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Smart insights */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-12 rounded-3xl p-6 text-white shadow-[0_20px_50px_-20px_rgba(37,99,235,0.45)]"
            style={{ background: `linear-gradient(135deg, ${BRAND.primary}, #2563EB)` }}
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-90">Smart insights</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {insights.map((it, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/15"
                >
                  <it.icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
                  <p className="text-xs leading-snug">{it.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Middle CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, duration: 0.7 }}
          className="mt-10 flex justify-center"
        >
          <a href="#dashboard" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md">
            <Sparkles className="h-4 w-4" style={{ color: BRAND.primary }} />
            See Demo
            <ArrowRight className="h-3.5 w-3.5 text-gray-600" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", title: "Add your salary cycle", desc: "Set payday. We build your month around it." },
    { n: "2", title: "Track UPI & expenses automatically", desc: "Log spends in seconds with auto-categories." },
    { n: "3", title: "Save more, stress less", desc: "Stay on budget and breathe easy at month-end." },
  ];
  return (
    <section id="how" className="bg-white py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-gray-900 md:text-2xl">How it works</h2>
          <p className="mt-1 text-xs text-gray-500">Three steps. No spreadsheets.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 1, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-gray-500">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function useCountUp(target: number, duration = 1400) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return { ref, val };
}

function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const { ref, val } = useCountUp(to);
  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

function StatsStrip() {
  const stats = [
    { to: 12000, suffix: "+", label: "Indians on waitlist" },
    { to: 6400, prefix: "₹", label: "Avg. saved / month" },
    { to: 98, suffix: "%", label: "Love the SMS auto-detect" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 pb-2 pt-2">
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-gray-100 bg-white/70 p-4 shadow-sm backdrop-blur md:gap-6 md:p-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-xl font-bold text-gray-900 md:text-3xl" style={{ color: BRAND.primary }}>
              <Counter to={s.to} prefix={s.prefix} suffix={s.suffix} />
            </p>
            <p className="mt-1 text-[10px] font-medium text-gray-500 md:text-xs">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const cards = [
    {
      name: "Aarav S.",
      role: "Software Engineer · Bengaluru",
      grad: "from-blue-50 to-indigo-50",
      ring: "ring-blue-100",
      quote:
        "I used to wonder where my ₹23,000 salary disappears every month. FinTrackr showed me ₹6,000 was just on food delivery.",
    },
    {
      name: "Priya M.",
      role: "Marketing Lead · Pune",
      grad: "from-emerald-50 to-teal-50",
      ring: "ring-emerald-100",
      quote: "Finally an app that understands Indian expenses.",
    },
    {
      name: "Rahul K.",
      role: "Student · Delhi",
      grad: "from-amber-50 to-orange-50",
      ring: "ring-amber-100",
      quote: "Simple. Clean. No confusion.",
    },
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">What our users say</h2>
        <p className="mt-3 text-sm text-gray-600">
          Real stories from real salary earners across India.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => {
          const initials = c.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2);
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className={`group relative rounded-3xl bg-gradient-to-br ${c.grad} p-6 ring-1 ${c.ring} shadow-[0_10px_40px_-20px_rgba(17,24,39,0.18)] transition-shadow hover:shadow-[0_24px_60px_-20px_rgba(17,24,39,0.25)]`}
            >
              <Quote className="absolute right-5 top-5 h-7 w-7 text-white/85" />
              <p className="text-sm leading-relaxed text-gray-800">"{c.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-[11px] text-gray-500">{c.role}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
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
      <div className="pointer-events-none absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/[0.06] blur-[100px]" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-teal-300/[0.10] blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-300/[0.10] blur-[80px]" />

      <div className="relative mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-white md:text-5xl"
        >
          Start tracking your money today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/80 md:text-base"
        >
          Join Indian salary earners who finally understand where their money goes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link to="/signup">
            <Button
              size="lg"
              className="rounded-xl bg-white px-7 text-sm font-semibold text-[#0F766E] shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white/95"
              style={{ boxShadow: "0 20px 50px -15px rgba(0,0,0,0.25)" }}
            >
              Create Free Account <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button
              size="lg"
              variant="ghost"
              className="rounded-xl px-7 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:bg-white/10 hover:ring-white/40"
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
          className="mt-5 text-xs font-medium text-white/80"
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
        { label: "Early Access", href: "#early" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Contact", href: "mailto:hello@fintrackr.app" },
      ],
    },
  ];
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-xs text-gray-500">
            An intelligent money control center built for Indian salary life.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-gray-700 transition-colors hover:text-gray-900"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 sm:flex-row">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} FinTrackr
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-gray-500">
            Made with <Heart className="h-3 w-3 fill-red-500 text-red-500" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.bg, color: BRAND.text }}>
      <Navbar />
      <main>
        <Hero />
        <DashboardShowcase />
        <ProblemSection />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
