import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  IndianRupee,
  PiggyBank,
  ShoppingBag,
  Home,
  Info,
  CheckCircle2,
  Copy,
  PieChart,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/guides/50-30-20-budget-calculator-india")({
  head: () => ({
    meta: [
      { title: "50-30-20 Budget Calculator for India — FinTrackr" },
      {
        name: "description",
        content:
          "Free 50-30-20 budget calculator tailored for Indian salary earners. Split your take-home salary into needs, wants and savings with INR formatting, salary-cycle tips and SIP/EMI guidance.",
      },
      { property: "og:title", content: "50-30-20 Budget Calculator for India — FinTrackr" },
      {
        property: "og:description",
        content:
          "Split your Indian take-home salary into needs (50%), wants (30%) and savings (20%). Built for monthly salary cycles, INR and real Indian expenses.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "keywords",
        content:
          "50 30 20 budget calculator India, salary budget India, monthly budget planner India, 50 30 20 rule Indian salary, SIP budget calculator",
      },
    ],
    links: [{ rel: "canonical", href: "/guides/50-30-20-budget-calculator-india" }],
  }),
  component: BudgetCalculatorGuide,
});

function formatInr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function parseMoney(value: string) {
  const digits = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(digits);
  return Number.isNaN(num) ? 0 : num;
}

const DEFAULT_SALARY = 75000;
const DEFAULT_RENT = 18000;
const DEFAULT_EMI = 12000;
const DEFAULT_BILLS = 5000;

function BudgetCalculatorGuide() {
  const [salaryRaw, setSalaryRaw] = useState(formatInr(DEFAULT_SALARY));
  const [rentRaw, setRentRaw] = useState(formatInr(DEFAULT_RENT));
  const [emiRaw, setEmiRaw] = useState(formatInr(DEFAULT_EMI));
  const [billsRaw, setBillsRaw] = useState(formatInr(DEFAULT_BILLS));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  const salary = useMemo(() => parseMoney(salaryRaw), [salaryRaw]);
  const rent = useMemo(() => parseMoney(rentRaw), [rentRaw]);
  const emi = useMemo(() => parseMoney(emiRaw), [emiRaw]);
  const bills = useMemo(() => parseMoney(billsRaw), [billsRaw]);

  const needs = salary * 0.5;
  const wants = salary * 0.3;
  const savings = salary * 0.2;
  const committed = rent + emi + bills;
  const committedOfNeeds = Math.min(committed, needs);
  const freeNeeds = Math.max(0, needs - committed);
  const overCommitment = Math.max(0, committed - needs);

  const dailySafeSpend = salary / 30;
  const weeklySafeSpend = salary / 4;

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseMoney(e.target.value);
    setSalaryRaw(formatInr(num));
  };

  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRentRaw(formatInr(parseMoney(e.target.value)));
  };

  const handleEmiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmiRaw(formatInr(parseMoney(e.target.value)));
  };

  const handleBillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBillsRaw(formatInr(parseMoney(e.target.value)));
  };

  const copySummary = () => {
    const text = `My 50-30-20 budget for ${formatInr(salary)}/month\nNeeds (50%): ${formatInr(needs)}\nWants (30%): ${formatInr(wants)}\nSavings (20%): ${formatInr(savings)}\nCalculated with FinTrackr`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const publishedISO = "2026-08-30";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "50-30-20 Budget Calculator for Indian Salary Earners",
    description:
      "Interactive 50-30-20 budget calculator for India. Split monthly take-home salary into needs, wants and savings with INR formatting and Indian salary-cycle tips.",
    datePublished: publishedISO,
    author: { "@type": "Organization", name: "FinTrackr" },
    publisher: { "@type": "Organization", name: "FinTrackr" },
    mainEntityOfPage: "https://fintrackrapp.lovable.app/guides/50-30-20-budget-calculator-india",
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
            FinTrackr Tools · Salary Survival
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            50-30-20 Budget Calculator for India
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            The classic 50-30-20 rule, rebuilt for Indian salary life. Enter your monthly
            take-home salary and see exactly how much should go to needs, wants and savings —
            in rupees, not percentages.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calculator className="h-5 w-5 text-primary" />
              Budget Calculator
            </CardTitle>
            <CardDescription>
              Adjust your take-home pay. Add rent, EMI and bills to see how much of your 50%
              needs bucket is already committed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="salary" className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                Monthly take-home salary
              </Label>
              <Input
                id="salary"
                inputMode="numeric"
                value={salaryRaw}
                onChange={handleSalaryChange}
                placeholder="₹75,000"
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                Use the amount credited to your bank after PF, tax and other deductions.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Info className="h-4 w-4" />
                {showAdvanced ? "Hide committed expenses" : "Add committed expenses"}
              </button>

              {showAdvanced && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="rent" className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-muted-foreground" /> Rent
                    </Label>
                    <Input
                      id="rent"
                      inputMode="numeric"
                      value={rentRaw}
                      onChange={handleRentChange}
                      placeholder="₹18,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emi" className="flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" /> EMI
                    </Label>
                    <Input
                      id="emi"
                      inputMode="numeric"
                      value={emiRaw}
                      onChange={handleEmiChange}
                      placeholder="₹12,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bills" className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Bills
                    </Label>
                    <Input
                      id="bills"
                      inputMode="numeric"
                      value={billsRaw}
                      onChange={handleBillsChange}
                      placeholder="₹5,000"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="grid gap-6 sm:grid-cols-3">
                <BucketCard
                  icon={Home}
                  label="Needs"
                  percent={50}
                  amount={needs}
                  colorClass="bg-info"
                  examples="Rent, groceries, EMI, bills, school fees, transport"
                />
                <BucketCard
                  icon={ShoppingBag}
                  label="Wants"
                  percent={30}
                  amount={wants}
                  colorClass="bg-warning"
                  examples="Dining out, OTT subscriptions, shopping, weekend trips"
                />
                <BucketCard
                  icon={PiggyBank}
                  label="Savings"
                  percent={20}
                  amount={savings}
                  colorClass="bg-success"
                  examples="Emergency fund, SIP, PPF, NPS, extra EMI prepayment"
                />
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">Budget split</span>
                    <span className="text-muted-foreground">{formatInr(salary)} total</span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-info" style={{ width: "50%" }} />
                    <div className="h-full bg-warning" style={{ width: "30%" }} />
                    <div className="h-full bg-success" style={{ width: "20%" }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-info" /> Needs 50%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-warning" /> Wants 30%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-success" /> Savings 20%
                    </span>
                  </div>
                </div>

                {showAdvanced && committed > 0 && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium">Committed vs. free needs</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You have already committed {formatInr(committed)} of your {formatInr(needs)}{" "}
                      needs bucket.
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Committed</span>
                        <span>{formatInr(committedOfNeeds)}</span>
                      </div>
                      <Progress value={(committedOfNeeds / needs) * 100} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span>Free for variable needs</span>
                        <span>{formatInr(freeNeeds)}</span>
                      </div>
                    </div>
                    {overCommitment > 0 && (
                      <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                        Your committed expenses exceed the 50% needs limit by{" "}
                        {formatInr(overCommitment)}. Consider trimming wants or increasing savings
                        later.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={copySummary} variant="outline" size="sm">
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" /> Copy budget
                  </>
                )}
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">
                  Track this in FinTrackr <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="text-2xl font-semibold">How the 50-30-20 rule works in India</h2>
        <p className="mt-3 text-muted-foreground">
          The rule splits your post-deduction monthly income into three simple buckets. It works
          especially well for Indian salaried households because most income arrives once a
          month, while UPI and quick-commerce make daily wants almost frictionless.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <RuleCard
            title="50% Needs"
            desc="Non-negotiables: rent/EMI, groceries, school fees, fuel, electricity, mobile/internet, health insurance."
            highlight="If these cross 50%, your budget is already tight."
          />
          <RuleCard
            title="30% Wants"
            desc="Lifestyle spending: Swiggy/Zomato, OTT, cabs, shopping, hobbies, weekend getaways."
            highlight="This is the first bucket to cut when money is short."
          />
          <RuleCard
            title="20% Savings"
            desc="Emergency fund, SIPs, PPF, NPS, extra EMI payments and long-term goals."
            highlight="Pay yourself first — automate this within 24 hours of salary."
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="text-2xl font-semibold">Salary-cycle tips for Indian earners</h2>
        <ul className="mt-4 space-y-3 text-muted-foreground">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Automate savings on salary day.</strong> Set an
              auto-debit SIP or recurring deposit for the 20% bucket within 24 hours of credit.
            </span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Use UPI with a daily ceiling.</strong> Divide
              your wants bucket by 30 to get a rough daily fun-money limit: around{" "}
              {formatInr(wants / 30)} for your current inputs.
            </span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Build a 3-month emergency fund first</strong>{" "}
              before aggressive investing. That equals roughly {formatInr(salary * 3)} for your
              current salary.
            </span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">Revisit every quarter.</strong> Bonuses,
              increments and new EMIs change the math. Recalculate when income or commitments
              shift.
            </span>
          </li>
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="text-2xl font-semibold">FAQs</h2>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Should I use CTC or take-home salary?</p>
            <p>
              Always use take-home salary — the amount that actually lands in your bank after PF,
              tax, professional tax and other deductions. CTC includes costs you never see.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">What if my rent + EMI is more than 50%?</p>
            <p>
              Many Indian metro households face this. Treat it as a signal: either reduce wants
              sharply, look for ways to increase income, or restructure debt. The 50% rule is a
              target, not a jail sentence.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Is 20% savings enough?</p>
            <p>
              20% is a solid starting point. If you have no high-interest debt and your emergency
              fund is full, you can push savings toward 30% or more.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I include annual bonus in this?</p>
            <p>
              Keep the calculator focused on monthly income for regular budgeting. Route most of your
              bonus straight to savings, debt prepayment or annual goals.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Want this budget to stick?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  FinTrackr tracks your UPI spends, salary cycle and safe daily spend automatically.
                </p>
              </div>
              <Button asChild>
                <Link to="/signup">
                  Try FinTrackr free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-muted-foreground">
          <PieChart className="mr-1 inline h-3.5 w-3.5" /> FinTrackr · Built for Indian salary life.
        </div>
      </footer>
    </article>
  );
}

function BucketCard({
  icon: Icon,
  label,
  percent,
  amount,
  colorClass,
  examples,
}: {
  icon: React.ElementType;
  label: string;
  percent: number;
  amount: number;
  colorClass: string;
  examples: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{percent}%</p>
        </div>
      </div>
      <p className="mt-3 font-display text-2xl font-bold text-foreground">{formatInr(amount)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{examples}</p>
    </div>
  );
}

function RuleCard({ title, desc, highlight }: { title: string; desc: string; highlight: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <p className="mt-3 text-xs font-medium text-primary">{highlight}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SliderDemo = Slider; // keep import used if ever extended

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
