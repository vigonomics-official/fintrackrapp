import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Database, PenLine, ChevronRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { AnalyzeForm, COACH_INPUT_STORAGE_KEY } from "@/components/finance/AnalyzeForm";
import { useTransactions, useCategories } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { buildCoachAutofill } from "@/lib/coach-autofill";
import { analyzeMock, type CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { CoachAdviceTab } from "@/components/finance/CoachAdviceTab";
import { CoachPlanTab } from "@/components/finance/CoachPlanTab";
import { CoachChatSheet } from "@/components/finance/CoachChatSheet";
import { CoachAnalyzeReady } from "@/components/finance/CoachAnalyzeReady";
import {
  getFinancialProfile,
  getCachedAnalysis,
  setCachedAnalysis,
  computeAnalysisSignature,
  onProfileUpdated,
} from "@/lib/financial-profile";

const COACH_OPEN_FORM_KEY = "fintrackr:ai-coach:open-form";

export const Route = createFileRoute("/_authenticated/insights/ai-coach")({
  component: AiCoachRoute,
  head: () => ({ meta: [{ title: "AI Salary Survival Coach — FinTrackr" }] }),
});

function AiCoachRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/insights/ai-coach") return <Outlet />;
  return <AiCoachPage />;
}

type AnalyzeMode = "choice" | "form";

function AiCoachPage() {
  const [activeTab, setActiveTab] = useState<string>("analyze");
  const [mode, setMode] = useState<AnalyzeMode>("choice");
  const [useAutoData, setUseAutoData] = useState(false);
  const [savedInput, setSavedInput] = useState<Partial<CoachAnalysisInput> | null>(null);
  // Shared latest analysis input across Analyze / Advice / Plan tabs.
  const [latestInput, setLatestInput] = useState<CoachAnalysisInput | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  // Live autofill (recomputes when transactions/categories/profile change).
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { settings } = useSalarySettings();
  const queryClient = useQueryClient();

  const autofill = useMemo(
    () => buildCoachAutofill({ transactions, categories, salary: settings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, categories, settings, profileVersion],
  );

  const readLatestInput = useCallback((): CoachAnalysisInput | null => {
    try {
      const cached = getCachedAnalysis();
      if (cached?.input) return cached.input;
      const raw = sessionStorage.getItem(COACH_INPUT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CoachAnalysisInput) : null;
    } catch {
      return null;
    }
  }, []);

  // If the user came from "Improve My Data" on the results page, open the
  // form directly and pre-seed it with their last analysed input.
  useEffect(() => {
    setLatestInput(readLatestInput());
    try {
      const flag = sessionStorage.getItem(COACH_OPEN_FORM_KEY);
      if (flag) {
        sessionStorage.removeItem(COACH_OPEN_FORM_KEY);
        const raw = sessionStorage.getItem(COACH_INPUT_STORAGE_KEY);
        if (raw) setSavedInput(JSON.parse(raw) as Partial<CoachAnalysisInput>);
        setUseAutoData(!raw);
        setMode("form");
      }
    } catch {
      /* ignore */
    }
  }, [readLatestInput]);

  // React to profile / balance / savings updates from other components.
  useEffect(() => onProfileUpdated(() => setProfileVersion((v) => v + 1)), []);

  // Build a signature for the current autofill so we know when to refresh
  // the cached analysis.
  const buildAutoInput = useCallback((): CoachAnalysisInput | null => {
    const v = autofill.values;
    if (!v.monthlySalary || !v.salaryDate) return null;
    return {
      monthlySalary: v.monthlySalary ?? 0,
      salaryDate: v.salaryDate ?? new Date().toISOString().slice(0, 10),
      currentAccountBalance: v.currentAccountBalance ?? 0,
      monthlyRent: v.monthlyRent ?? 0,
      monthlyFood: v.monthlyFood ?? 0,
      monthlyTransport: v.monthlyTransport ?? 0,
      monthlyEmi: v.monthlyEmi ?? 0,
      monthlyBills: v.monthlyBills ?? 0,
      monthlyInvestments: v.monthlyInvestments ?? 0,
      currentSavings: v.currentSavings ?? 0,
      otherMonthlyExpenses: v.otherMonthlyExpenses ?? 0,
      financialGoal: v.financialGoal ?? "Emergency Fund",
      customGoalNote: v.customGoalNote,
    };
  }, [autofill]);

  // On mount / when inputs change: if we have enough to analyse and no cache
  // (or an out-of-date cache), warm the cache silently so the "ready" view
  // has something to show.
  useEffect(() => {
    const auto = buildAutoInput();
    if (!auto) return;
    const cached = getCachedAnalysis();
    const sig = computeAnalysisSignature(auto, {
      transactionCount: autofill.transactionCount,
      lastTxDate: transactions?.[0]?.transaction_date ?? null,
    });
    if (!cached || cached.signature !== sig) {
      const result = analyzeMock(auto);
      setCachedAnalysis({
        signature: sig,
        input: auto,
        result,
        computedAt: new Date().toISOString(),
      });
      try {
        sessionStorage.setItem(COACH_INPUT_STORAGE_KEY, JSON.stringify(auto));
      } catch {
        /* ignore */
      }
      setLatestInput(auto);
    } else if (!latestInput) {
      setLatestInput(cached.input);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofill, transactions]);

  const profile = useMemo(() => getFinancialProfile(), [profileVersion]);
  const hasProfile = !!(profile.monthlySalary && profile.salaryDate);

  const cached = useMemo(() => getCachedAnalysis(), [latestInput, profileVersion]);
  const showReady = mode === "choice" && !!(cached ?? latestInput) && hasProfile;

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
    // Force recompute by bumping the version — cache signature will diverge.
    setProfileVersion((v) => v + 1);
  }, [queryClient]);

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-3 border-b bg-card/40 px-4 py-4 backdrop-blur md:px-10 md:py-6">
        <Link
          to="/insights"
          aria-label="Back to Insights"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 truncate font-display text-lg font-bold tracking-tight md:text-2xl">
            <Sparkles className="h-4 w-4 shrink-0 text-primary md:h-5 md:w-5" />
            <span className="truncate">AI Salary Survival Coach</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
            Your personal salary survival assistant powered by AI.
          </p>
        </div>
      </div>

      <PageContainer>
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setMode("choice");
            setUseAutoData(false);
            setLatestInput(readLatestInput());
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analyze">Analyze</TabsTrigger>
            <TabsTrigger value="advice">Advice</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="mt-4">
            {showReady ? (
              <CoachAnalyzeReady
                input={(cached?.input ?? latestInput) as CoachAnalysisInput}
                computedAt={cached?.computedAt ?? autofill.computedAt}
                transactionCount={autofill.transactionCount}
                onEdit={() => {
                  setSavedInput((cached?.input ?? latestInput) as Partial<CoachAnalysisInput>);
                  setUseAutoData(false);
                  setMode("form");
                }}
                onRefresh={handleRefreshAll}
                onBalanceUpdated={(next) => {
                  const sig = computeAnalysisSignature(next, {
                    transactionCount: autofill.transactionCount,
                    lastTxDate: transactions?.[0]?.transaction_date ?? null,
                  });
                  setCachedAnalysis({
                    signature: sig,
                    input: next,
                    result: analyzeMock(next),
                    computedAt: new Date().toISOString(),
                  });
                  try {
                    sessionStorage.setItem(COACH_INPUT_STORAGE_KEY, JSON.stringify(next));
                  } catch {
                    /* ignore */
                  }
                  setLatestInput(next);
                  setProfileVersion((v) => v + 1);
                }}
              />
            ) : mode === "choice" ? (
              <AnalyzeChoice
                onManual={() => {
                  setSavedInput(null);
                  setUseAutoData(false);
                  setMode("form");
                }}
                onAuto={() => {
                  setSavedInput(null);
                  setUseAutoData(true);
                  setMode("form");
                }}
              />
            ) : (
              <AnalyzeFormWithAutofill
                useAutoData={useAutoData}
                initialOverride={savedInput}
                onBack={() => {
                  setSavedInput(null);
                  setMode("choice");
                }}
              />
            )}
          </TabsContent>
          <TabsContent value="advice" className="mt-4">
            <CoachAdviceTab
              onGoToAnalyze={() => setActiveTab("analyze")}
              isActive={activeTab === "advice"}
              analysisInput={latestInput}
            />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <CoachPlanTab
              isActive={activeTab === "plan"}
              analysisInput={latestInput}
              onGoToAnalyze={() => setActiveTab("analyze")}
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
      <CoachChatSheet analysisInput={latestInput} onGoToAnalyze={() => setActiveTab("analyze")} />
    </PageShell>
  );
}

function AnalyzeChoice({ onAuto, onManual }: { onAuto: () => void; onManual: () => void }) {
  const navigate = useNavigate();
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { settings } = useSalarySettings();

  const autofill = useMemo(
    () => buildCoachAutofill({ transactions, categories, salary: settings }),
    [transactions, categories, settings],
  );

  const hasAnyTransactions = (transactions?.length ?? 0) > 0;

  const handleAuto = () => {
    if (autofill.hasEnough) {
      const input: CoachAnalysisInput = {
        monthlySalary: autofill.values.monthlySalary ?? 0,
        salaryDate: autofill.values.salaryDate ?? new Date().toISOString().slice(0, 10),
        currentAccountBalance: autofill.values.currentAccountBalance ?? 0,
        monthlyRent: autofill.values.monthlyRent ?? 0,
        monthlyFood: autofill.values.monthlyFood ?? 0,
        monthlyTransport: autofill.values.monthlyTransport ?? 0,
        monthlyEmi: autofill.values.monthlyEmi ?? 0,
        monthlyBills: autofill.values.monthlyBills ?? 0,
        monthlyInvestments: autofill.values.monthlyInvestments ?? 0,
        currentSavings: autofill.values.currentSavings ?? 0,
        otherMonthlyExpenses: autofill.values.otherMonthlyExpenses ?? 0,
        financialGoal: "Emergency Fund",
      };
      try {
        sessionStorage.setItem(COACH_INPUT_STORAGE_KEY, JSON.stringify(input));
        // Warm the mock so future providers (Gemini) can hook in identically.
        analyzeMock(input);
      } catch {
        /* ignore */
      }
      // Auto-fill was enough — open the form in locked "Data Ready" mode so
      // the user can review before analyzing, instead of jumping straight
      // to results and inviting accidental edits later.
      onAuto();
      return;
    }
    onAuto();
  };

  const filledCount = autofill.filled.size;

  // Empty state — no transactions in FinTrackr at all.
  if (!hasAnyTransactions) {
    return (
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Database className="h-5 w-5" />
          </div>
          <p className="font-display text-sm font-semibold">No financial history found</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            You can import transactions, enable SMS tracking, or enter your data manually.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/import" })}>
            Import Transactions
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/sms-intelligence" })}>
            Enable SMS Tracking
          </Button>
          <Button size="sm" onClick={onManual}>
            Enter Manually
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card
        role="button"
        tabIndex={0}
        onClick={handleAuto}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleAuto();
          }
        }}
        className="cursor-pointer p-4 shadow-soft transition-colors hover:bg-muted/40 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <span aria-hidden>🟢</span>
              Analyze Using My FinTrackr Data
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Automatically use your salary, expenses, bills, investments and spending history.
            </p>
            {filledCount > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <CheckCircle2 className="h-3 w-3" />
                {autofill.hasEnough
                  ? "Ready — we have enough to analyse"
                  : `${filledCount} field${filledCount === 1 ? "" : "s"} pre-filled from your history`}
              </p>
            )}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={onManual}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onManual();
          }
        }}
        className="cursor-pointer p-4 shadow-soft transition-colors hover:bg-muted/40 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <PenLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <span aria-hidden>✍️</span>
              Enter Manually
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Fill in your salary, expenses and goal by hand.
            </p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    </div>
  );
}

function AnalyzeFormWithAutofill({
  useAutoData,
  initialOverride,
  onBack,
}: {
  useAutoData: boolean;
  initialOverride?: Partial<CoachAnalysisInput> | null;
  onBack: () => void;
}) {
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { settings } = useSalarySettings();
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const autofill = useMemo(
    () => buildCoachAutofill({ transactions, categories, salary: settings }),
    [transactions, categories, settings],
  );

  const initial = initialOverride ?? (useAutoData ? autofill.values : undefined);
  const filled = initialOverride ? undefined : useAutoData ? autofill.filled : undefined;
  const sources = useAutoData && !initialOverride ? autofill.sources : undefined;
  const transactionCount = useAutoData ? autofill.transactionCount : 0;
  const computedAt = useAutoData ? autofill.computedAt : null;
  // Only lock the "Data Ready" view when auto-fill actually populated the
  // required fields — otherwise the user needs to type immediately.
  const startLocked = useAutoData && !initialOverride && autofill.hasEnough;

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-8 px-2 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Choose a different option
        </Button>
        {useAutoData && (
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 px-2">
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh Data
          </Button>
        )}
      </div>
      <AnalyzeForm
        key={refreshKey}
        initial={initial}
        autoFilled={filled}
        sources={sources}
        transactionCount={transactionCount}
        computedAt={computedAt}
        startLocked={startLocked}
      />
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center shadow-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </Card>
  );
}
