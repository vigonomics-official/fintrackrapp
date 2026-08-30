import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Wallet, TrendingDown, PieChart, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guides/upi-micro-spending")({
  head: () => ({
    meta: [
      { title: "UPI Spending Tracker: Managing Micro-Transactions on a Salary" },
      {
        name: "description",
        content:
          "A practical guide for Indian salary earners to track ₹50–₹200 UPI micro-spends that silently drain your monthly savings. Learn strategies, tools, and habits.",
      },
      { property: "og:title", content: "UPI Spending Tracker: Managing Micro-Transactions" },
      {
        property: "og:description",
        content:
          "Learn how to track and control small daily UPI spends and protect your monthly salary savings.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "keywords", content: "UPI spending tracker, UPI micro-transactions, salary savings India, track small UPI spends" },
    ],
    links: [{ rel: "canonical", href: "/guides/upi-micro-spending" }],
  }),
  component: UpiMicroSpendingGuide,
});

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-3xl px-5 py-8">
      {children}
    </section>
  );
}

function UpiMicroSpendingGuide() {
  const publishedISO = "2026-01-15";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "UPI Spending Tracker: Managing Micro-Transactions on a Salary",
    description:
      "A practical guide for Indian salary earners to track ₹50–₹200 UPI micro-spends that silently drain monthly savings.",
    datePublished: publishedISO,
    author: { "@type": "Organization", name: "FinTrackr" },
    publisher: { "@type": "Organization", name: "FinTrackr" },
    mainEntityOfPage: "https://fintrackrapp.lovable.app/guides/upi-micro-spending",
  };

  return (
    <article className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            FinTrackr Guides · Salary Survival
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            UPI Spending Tracker: Managing the ₹50–₹200 Micro-Spends That Drain Your Salary
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Small UPI payments feel harmless in the moment — a ₹90 chai, a ₹150 auto ride, a
            ₹200 quick-commerce order. Added up across a month, they quietly consume the exact
            money you meant to save. This guide shows how to track, categorise and cap those
            micro-spends without giving up convenience.
          </p>
        </div>
      </header>

      <Section>
        <h2 className="text-2xl font-semibold">Why UPI micro-spends hurt salary earners the most</h2>
        <p className="mt-3 text-muted-foreground">
          Salaries land once a month, but UPI runs 24×7. A single ₹120 spend a day is
          <strong className="text-foreground"> ₹3,600 a month</strong> — often more than an
          entire SIP or emergency-fund contribution. Because each transaction is small, it
          skips the "should I really buy this?" filter that a ₹3,000 purchase would trigger.
        </p>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          <li className="flex gap-2"><TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Invisible drain — no single spend feels significant.</li>
          <li className="flex gap-2"><Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Payday euphoria — the first 10 days see 40–60% of monthly UPI outflow.</li>
          <li className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Notification fatigue — bank SMS pile up and stop being read.</li>
        </ul>
      </Section>

      <Section id="rules">
        <h2 className="text-2xl font-semibold">Five rules for tracking UPI micro-transactions</h2>
        <ol className="mt-4 space-y-4 text-muted-foreground">
          <li>
            <p className="font-medium text-foreground">1. Capture every spend the same day</p>
            <p>Import bank SMS or link your account so ₹50 spends are recorded automatically, not from memory.</p>
          </li>
          <li>
            <p className="font-medium text-foreground">2. Group by intent, not by merchant</p>
            <p>"Food delivery," "cabs," and "quick-commerce" reveal habits. Merchant-level lists don't.</p>
          </li>
          <li>
            <p className="font-medium text-foreground">3. Set a daily safe-spend ceiling</p>
            <p>Divide the money left in your salary cycle by days remaining. That's your true daily budget.</p>
          </li>
          <li>
            <p className="font-medium text-foreground">4. Review weekly, not monthly</p>
            <p>Course-correct on day 7, not day 30 when the damage is done.</p>
          </li>
          <li>
            <p className="font-medium text-foreground">5. Automate savings before UPI can touch it</p>
            <p>Move savings within 24 hours of payday. What isn't there can't be micro-spent.</p>
          </li>
        </ol>
      </Section>

      <Section>
        <h2 className="text-2xl font-semibold">A simple weekly UPI review (5 minutes)</h2>
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Sum this week's UPI outflow.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Identify the top 3 categories.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Flag any category that grew &gt;20% over last week.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Recalculate your safe daily spend for the days left until payday.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Pick one category to cap for the next 7 days.</li>
          </ul>
        </div>
      </Section>

      <Section>
        <h2 className="text-2xl font-semibold">How FinTrackr helps</h2>
        <p className="mt-3 text-muted-foreground">
          FinTrackr auto-categorises UPI transactions from bank SMS, shows a live
          safe-daily-spend number tied to your salary cycle, and warns you when a category
          starts trending over budget — before it eats your savings.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">
              Try FinTrackr free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/guides/50-30-20-budget-calculator-india">
              50-30-20 budget calculator
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </Section>

      <Section>
        <h2 className="text-2xl font-semibold">FAQs</h2>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">What counts as a UPI micro-transaction?</p>
            <p>Any UPI spend under roughly ₹300 — small enough that people rarely log it manually.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How much do micro-spends usually cost per month?</p>
            <p>For most salaried users we see ₹3,000–₹8,000/month — often 8–15% of take-home salary.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Do I need to give up UPI to save more?</p>
            <p>No. You need visibility and a daily cap. UPI itself is a tool; the missing layer is tracking.</p>
          </div>
        </div>
      </Section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-muted-foreground">
          <PieChart className="mr-1 inline h-3.5 w-3.5" /> FinTrackr · Built for Indian salary life.
        </div>
      </footer>
    </article>
  );
}
