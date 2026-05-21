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
  Target,
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
    ],
  }),
  component: Landing,
});

const BRAND = {
  primary: "#1A56DB",
  accent: "#10B981",
  bg: "#F9FAFB",
  text: "#111827",
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
          <a href="#early" className="text-sm font-medium text-gray-600 hover:text-gray-900">Early Access</a>
        </div>
        <a href="#early">
          <Button
            className="rounded-xl text-white shadow-sm hover:opacity-90"
            style={{ backgroundColor: BRAND.primary }}
          >
            Get Early Access <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </a>
      </nav>
    </header>
  );
}

function FloatingCTA() {
  return (
    <a
      href="#early"
      className="fixed bottom-5 right-5 z-50 md:hidden"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
        className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
        style={{ backgroundColor: BRAND.primary, boxShadow: "0 10px 30px -10px rgba(26,86,219,0.55)" }}
      >
        Get Early Access <ArrowRight className="h-4 w-4" />
      </motion.div>
    </a>
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
      {/* Phone frame */}
      <div className="relative rounded-[2.2rem] border border-gray-200 bg-white p-3 shadow-[0_30px_60px_-20px_rgba(17,24,39,0.25)]">
        <div className="rounded-[1.7rem] bg-gradient-to-br from-gray-50 to-white p-5">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Good morning, Aarav</p>
              <p className="text-base font-semibold text-gray-900">November Budget</p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: BRAND.primary }}
            >
              A
            </div>
          </div>

          {/* Budget ring */}
          <div className="mt-5 flex items-center gap-4">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="3.2" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke={BRAND.primary}
                  strokeWidth="3.2"
                  strokeDasharray="68 100"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-medium text-gray-500">Spent</span>
                <span className="text-sm font-bold text-gray-900">68%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Remaining this month</p>
              <p className="text-2xl font-bold text-gray-900">₹ 12,840</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: BRAND.accent }}>
                <TrendingDown className="h-3 w-3" /> Spending down 18%
              </p>
            </div>
          </div>

          {/* Mini chart */}
          <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-700">Weekly spend</p>
              <p className="text-[10px] text-gray-400">Mon – Sun</p>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-md"
                  style={{
                    height: `${h}%`,
                    background:
                      i === 5
                        ? `linear-gradient(180deg, ${BRAND.primary}, ${BRAND.accent})`
                        : "#E5E7EB",
                  }}
                />
              ))}
            </div>
          </div>

          {/* UPI list */}
          <div className="mt-4 space-y-2">
            {[
              { name: "Swiggy", tag: "Food", amt: "− ₹ 348" },
              { name: "Uber", tag: "Transport", amt: "− ₹ 142" },
              { name: "Salary credited", tag: "Income", amt: "+ ₹ 62,000", income: true },
            ].map((t) => (
              <div key={t.name} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                  <p className="text-[10px] text-gray-500">{t.tag} · UPI</p>
                </div>
                <p
                  className="text-xs font-bold"
                  style={{ color: t.income ? BRAND.accent : "#111827" }}
                >
                  {t.amt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute -left-3 top-24 hidden rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 sm:block"
      >
        <p className="text-[10px] text-gray-500">Saved this month</p>
        <p className="text-sm font-bold" style={{ color: BRAND.accent }}>₹ 2,340</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
        className="absolute -right-3 top-56 hidden rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 sm:block"
      >
        <p className="flex items-center gap-1 text-[10px] text-gray-500">
          <CalendarClock className="h-3 w-3" /> Salary in
        </p>
        <p className="text-sm font-bold text-gray-900">5 days</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-gray-100 sm:block"
      >
        <p className="text-[10px] text-gray-500">Food spending</p>
        <p className="text-sm font-bold" style={{ color: BRAND.accent }}>↓ 18% this week</p>
      </motion.div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[520px] -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(26,86,219,0.10) 0%, rgba(16,185,129,0.05) 40%, rgba(249,250,251,0) 80%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-12 text-center md:pt-20">
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-700 shadow-sm"
        >
          <Sparkles className="h-3 w-3" style={{ color: BRAND.primary }} />
          Built for Indian salary life
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mx-auto mt-5 max-w-3xl font-display text-[2.1rem] font-bold leading-[1.1] tracking-tight text-gray-900 md:text-6xl"
        >
          Know exactly where your{" "}
          <span style={{ color: BRAND.primary }}>₹</span> goes.
          <br />
          <span className="text-gray-500">Every day. Every rupee.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-gray-600 md:text-lg"
        >
          FinTrackr helps salary earners and families track expenses, set budgets, and save more — without the confusion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <a href="#early" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full rounded-xl text-white shadow-md hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: BRAND.primary }}
            >
              Get Early Access <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </a>
          <a href="#how" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl border-gray-200 bg-white text-gray-800 hover:bg-gray-50 sm:w-auto"
            >
              See how it works
            </Button>
          </a>
        </motion.div>

        {/* Trust row */}
        <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-gray-500 md:text-xs">
          {["No bank login needed", "Built for India", "Early access users unlock premium features"].map((t) => (
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
              style={{ background: "rgba(26,86,219,0.08)", color: BRAND.primary }}
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

function ProblemSection() {
  const items = [
    { icon: Wallet, title: "Salary disappears quickly", desc: "Credit hits, and somehow it's gone by the 15th." },
    { icon: Receipt, title: "UPI spending confusion", desc: "Tiny ₹50–₹200 spends silently drain your balance." },
    { icon: CalendarClock, title: "Month-end stress", desc: "Rent, EMIs, bills — and barely anything left." },
    { icon: PiggyBank, title: "Don’t know how to save", desc: "You want to save, but never know where to start." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">Sound familiar?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-600">
          You're not alone. Millions of Indians live paycheck to paycheck — not because they earn less, but because no one shows them where it goes.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(17,24,39,0.08)]"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(16,185,129,0.10)", color: BRAND.accent }}
            >
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{it.title}</h3>
              <p className="mt-1 text-xs text-gray-600">{it.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-8 text-center text-base font-semibold text-gray-900">
        FinTrackr was built exactly for this.
      </p>
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
              style={{ background: "rgba(26,86,219,0.08)", color: BRAND.primary }}
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
            "radial-gradient(50% 60% at 50% 0%, rgba(26,86,219,0.07), transparent 70%)",
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
                    style={{ background: "rgba(26,86,219,0.08)", color: BRAND.primary }}
                  >
                    <ex.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{ex.from}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: "rgba(16,185,129,0.12)", color: BRAND.accent }}
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
  const txns = [
    { icon: Utensils, name: "Swiggy", tag: "Food", amt: 340 },
    { icon: Utensils, name: "Zomato", tag: "Food", amt: 220 },
    { icon: Fuel, name: "HP Petrol", tag: "Fuel", amt: 1200 },
    { icon: Landmark, name: "EMI HDFC", tag: "EMI", amt: 4500 },
    { icon: Home, name: "Rent", tag: "Housing", amt: 8000 },
    { icon: PhoneIcon, name: "Jio Recharge", tag: "Utilities", amt: 299 },
    { icon: TrendingUp, name: "SIP – Nifty 50", tag: "Invest", amt: 2000 },
  ];
  const pie = [
    { label: "Food", pct: 28, color: "#1A56DB" },
    { label: "EMI", pct: 32, color: "#10B981" },
    { label: "Rent", pct: 22, color: "#6366F1" },
    { label: "Other", pct: 18, color: "#F59E0B" },
  ];
  // Build pie offsets
  let acc = 0;
  const pieSegs = pie.map((p) => {
    const seg = { ...p, offset: acc };
    acc += p.pct;
    return seg;
  });

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 10%, rgba(26,86,219,0.10), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(16,185,129,0.10), transparent 60%)",
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
            Budget rings, spending pies, salary countdowns and smart insights — built for the way Indians actually spend.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {/* Main analytics card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7 rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">November · Spending</p>
                <p className="font-display text-2xl font-bold text-gray-900">₹ 16,559</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                ↓ 12% vs Oct
              </span>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {/* Pie chart */}
              <div className="flex items-center gap-5">
                <div className="relative h-32 w-32">
                  <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="4" />
                    {pieSegs.map((s) => (
                      <circle
                        key={s.label}
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke={s.color}
                        strokeWidth="4"
                        strokeDasharray={`${s.pct} ${100 - s.pct}`}
                        strokeDashoffset={-s.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-medium text-gray-500">Total</span>
                    <span className="text-sm font-bold text-gray-900">₹16.5k</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {pie.map((p) => (
                    <div key={p.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="font-medium text-gray-700">{p.label}</span>
                      <span className="text-gray-400">{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Animated bar chart */}
              <div className="rounded-2xl bg-gray-50/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-700">Weekly trend</p>
                  <p className="text-[10px] text-gray-400">Last 7 days</p>
                </div>
                <div className="mt-3 flex h-24 items-end gap-1.5">
                  {[35, 60, 45, 80, 50, 95, 55].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="flex-1 rounded-md"
                      style={{
                        background:
                          i === 5
                            ? `linear-gradient(180deg, ${BRAND.primary}, ${BRAND.accent})`
                            : "#E5E7EB",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Recent transactions</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  <MessageSquare className="h-3 w-3" /> Auto-detected from SMS
                </span>
              </div>
              <div className="divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-100">
                {txns.map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: "rgba(26,86,219,0.08)", color: BRAND.primary }}
                      >
                        <t.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                        <p className="text-[10px] text-gray-500">{t.tag} · UPI</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-900">− ₹ {t.amt.toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side column */}
          <div className="lg:col-span-5 space-y-5">
            {/* Budget ring + Salary countdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
            >
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24">
                  <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="3.5" />
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
                      transition={{ duration: 1 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-medium text-gray-500">Budget</span>
                    <span className="text-sm font-bold text-gray-900">72%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className="font-display text-2xl font-bold text-gray-900">₹ 9,441</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                    <CalendarClock className="h-3 w-3" /> Salary in 5 days
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Savings tracker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">Savings goal · Goa trip</p>
                  <p className="font-display text-xl font-bold text-gray-900">₹ 38,200 <span className="text-sm font-medium text-gray-400">/ 50,000</span></p>
                </div>
                <PiggyBank className="h-6 w-6" style={{ color: BRAND.accent }} />
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "76%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.accent})` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">On track — at this pace you'll hit it by Dec 18.</p>
            </motion.div>

            {/* Streak + Subscription alerts */}
            <div className="grid grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
              >
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <p className="text-xs font-semibold text-gray-700">Daily streak</p>
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-gray-900">28 <span className="text-sm font-medium text-gray-400">days</span></p>
                <p className="text-[11px] text-gray-500">Keep it going!</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.18)]"
              >
                <div className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" style={{ color: BRAND.primary }} />
                  <p className="text-xs font-semibold text-gray-700">Subscriptions</p>
                </div>
                <p className="mt-2 font-display text-2xl font-bold text-gray-900">₹ 1,196</p>
                <p className="text-[11px] text-gray-500">Netflix renews in 3d</p>
              </motion.div>
            </div>

            {/* Smart insight */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl p-5 text-white shadow-[0_20px_50px_-20px_rgba(26,86,219,0.45)]"
              style={{ background: `linear-gradient(135deg, ${BRAND.primary}, #1e40af)` }}
            >
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-widest opacity-90">Smart insight</p>
              </div>
              <p className="mt-2 text-sm font-medium leading-snug">
                Food orders are up <span className="font-bold">₹ 1,240</span> this week. Cooking 2 nights could save you ~₹ 800.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Add your salary cycle", desc: "Tell FinTrackr when your salary hits. We do the rest." },
    { n: "02", title: "Track UPI & expenses", desc: "Log spends in seconds — categories are auto-suggested." },
    { n: "03", title: "Save more, stress less", desc: "Stay within budget, hit goals, breathe at month-end." },
  ];
  return (
    <section id="how" className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900 md:text-4xl">How it works</h2>
          <p className="mt-3 text-sm text-gray-600">Three steps. No spreadsheets. No bank logins.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl border border-gray-100 bg-gray-50/60 p-6"
            >
              <span className="text-xs font-bold tracking-widest" style={{ color: BRAND.primary }}>
                {s.n}
              </span>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowDown className="absolute -bottom-3 left-1/2 hidden h-5 w-5 -translate-x-1/2 text-gray-300 md:block md:rotate-[-90deg]" />
              )}
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
              <Quote className="absolute right-5 top-5 h-7 w-7 text-white/60" />
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

function EarlyAccess() {
  const benefits = [
    { icon: MessageSquare, label: "SMS Intelligence" },
    { icon: Tags, label: "Smart Categorization" },
    { icon: Target, label: "Budget Tracking" },
    { icon: CalendarClock, label: "Salary Countdown" },
    { icon: TrendingUp, label: "Investment Tracking" },
  ];
  return (
    <section id="early" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-2xl md:p-14"
        style={{
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, #1e40af 55%, ${BRAND.accent} 135%)`,
        }}
      >
        {/* Floating glow blobs */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Sparkles className="h-3 w-3" /> Limited early access now open
          </span>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold leading-tight md:text-5xl">
            Limited early access now open.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/85 md:text-base">
            Join our first users and unlock all premium features during the early access phase.
          </p>

          <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {benefits.map((b) => (
              <div
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors hover:bg-white/25"
              >
                <b.icon className="h-3.5 w-3.5" />
                {b.label}
              </div>
            ))}
          </div>

          <div className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row">
            <Link to="/signup" className="flex-1">
              <Button
                size="lg"
                className="w-full rounded-xl bg-white font-semibold text-gray-900 shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-gray-100"
              >
                Get Early Access <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="flex-1">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-white/80">
            <Lock className="h-3 w-3" /> Built with real Indian salary earners.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-1/4 top-10 -z-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-10 -z-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-gray-900 md:text-5xl"
        >
          Start tracking your money today.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mx-auto mt-4 max-w-lg text-base text-gray-600"
        >
          Join hundreds of Indians who finally understand where their money goes.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-7 flex justify-center"
        >
          <Link to="/signup">
            <Button
              size="lg"
              className="rounded-xl px-7 text-white shadow-lg transition-transform hover:-translate-y-0.5"
              style={{
                backgroundColor: BRAND.primary,
                boxShadow: "0 20px 50px -15px rgba(26,86,219,0.55)",
              }}
            >
              Create Free Account <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
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
        <ProblemSection />
        <DashboardShowcase />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingCTA />
    </div>
  );
}
