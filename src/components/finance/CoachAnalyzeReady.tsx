// "Latest Analysis Ready" screen shown when a Financial Profile + cached
// analysis input already exist. Skips the data entry form entirely and
// gives the user quick actions: view full results, edit inputs, refresh,
// or update just the current balance.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, PencilLine, RefreshCw, Sparkles, Wallet, ChevronRight } from "lucide-react";
import { analyzeMock, type CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { formatCurrency } from "@/lib/currency";
import { useProfile } from "@/hooks/use-finance";
import { setRememberedBalance } from "@/lib/financial-profile";

function relativeTime(iso?: string | null): string {
  if (!iso) return "just now";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "just now";
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export function CoachAnalyzeReady({
  input,
  computedAt,
  transactionCount,
  onEdit,
  onRefresh,
  onBalanceUpdated,
}: {
  input: CoachAnalysisInput;
  computedAt?: string | null;
  transactionCount?: number;
  onEdit: () => void;
  onRefresh: () => void;
  /** Called after the user updates the current balance from the quick action. */
  onBalanceUpdated: (nextInput: CoachAnalysisInput) => void;
}) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";

  const result = useMemo(() => analyzeMock(input), [input]);
  const scoreTone =
    result.healthScore >= 70 ? "text-success" : result.healthScore >= 40 ? "text-gold" : "text-destructive";

  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState<string>(String(input.currentAccountBalance ?? 0));

  const submitBalance = () => {
    const n = Number(balanceDraft);
    if (!Number.isFinite(n) || n < 0) return;
    setRememberedBalance(n);
    onBalanceUpdated({ ...input, currentAccountBalance: Math.round(n) });
    setBalanceOpen(false);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 shadow-soft sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">Latest analysis ready</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Using your Financial Profile
              {typeof transactionCount === "number" && transactionCount > 0
                ? ` + ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}`
                : ""}
              {" · updated "}
              {relativeTime(computedAt)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Health score" value={`${result.healthScore}/100`} tone={scoreTone} />
          <MiniStat
            label="Monthly surplus"
            value={formatCurrency(result.monthlySurplus, currency)}
            tone={result.monthlySurplus >= 0 ? "text-success" : "text-destructive"}
          />
          <MiniStat label="Balance" value={formatCurrency(input.currentAccountBalance, currency)} />
          <MiniStat label="Savings" value={formatCurrency(input.currentSavings, currency)} />
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={() => navigate({ to: "/insights/ai-coach/results" })}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          View Full Analysis
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" size="sm" onClick={() => setBalanceOpen(true)}>
          <Wallet className="mr-1.5 h-4 w-4" />
          Update Balance
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <PencilLine className="mr-1.5 h-4 w-4" />
          Edit Financial Data
        </Button>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update current balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="balance" className="text-xs">
              Current Account Balance
            </Label>
            <Input
              id="balance"
              type="number"
              inputMode="decimal"
              min={0}
              value={balanceDraft}
              onChange={(e) => setBalanceDraft(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Saved for future analyses. Your AI Coach will re-check today's plan with the new balance.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setBalanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitBalance}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
