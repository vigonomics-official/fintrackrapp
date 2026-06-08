import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTransactions, useLoans, useProfile } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { ShoppingBag, ArrowRight, Sparkles } from "lucide-react";

export function CanIBuyThisDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const { settings: salarySettings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const [item, setItem] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [checked, setChecked] = useState(false);
  const amount = Number(amountStr) || 0;

  const before = useMemo(
    () => computeSurvival({ transactions, loans, salarySettings, extraSpend: 0 }),
    [transactions, loans, salarySettings]
  );
  const after = useMemo(
    () => computeSurvival({ transactions, loans, salarySettings, extraSpend: amount }),
    [transactions, loans, salarySettings, amount]
  );

  const reset = () => { setItem(""); setAmountStr(""); setChecked(false); };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const showResults = checked && amount > 0;

  const scoreDrop = before.score - after.score;
  const verdict = !showResults
    ? { tone: "neutral", title: "Enter an amount to check", msg: "Tell us how much it costs, then tap Check Now." }
    : amount > before.salaryLeft
      ? { tone: "danger", title: "Skip this one ❌", msg: "This is more than what's left till next salary." }
      : scoreDrop >= 20 || after.safeDaily < before.safeDaily * 0.5
        ? { tone: "danger", title: "Wait until next salary ⚠", msg: "This will tighten your daily safe spend a lot." }
        : scoreDrop >= 10
          ? { tone: "careful", title: "Think twice 🤔", msg: "You can afford it, but you'll feel the squeeze." }
          : { tone: "safe", title: "You can buy this ✅", msg: "Comfortably within your safe spend." };

  const toneCls = verdict.tone === "danger"
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : verdict.tone === "careful"
      ? "border-gold/30 bg-gold/10 text-gold-foreground"
      : verdict.tone === "safe"
        ? "border-success/30 bg-success/10 text-success"
        : "border-border bg-muted/40 text-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShoppingBag className="h-5 w-5 text-primary" /> Can I buy this?
          </DialogTitle>
          <DialogDescription>A quick gut-check before you spend.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cibt-item" className="text-xs">Item</Label>
            <Input id="cibt-item" placeholder="e.g. Running shoes" value={item} onChange={(e) => setItem(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cibt-amount" className="text-xs">Amount ({currency})</Label>
            <Input id="cibt-amount" type="number" inputMode="decimal" placeholder="2499"
              value={amountStr} onChange={(e) => { setAmountStr(e.target.value); setChecked(false); }} />
          </div>
        </div>

        {showResults && (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">If you buy this</p>
            <Row label="Safe spend / day" before={formatCurrency(before.safeDaily, currency)} after={formatCurrency(after.safeDaily, currency)} />
            <Row label="Survival score" before={`${before.score}%`} after={`${after.score}%`} />
            <Row label="EMI pressure" before={before.emiLevel} after={after.emiLevel} />
            <Row label="Salary left" before={formatCurrency(before.salaryLeft, currency)} after={formatCurrency(after.salaryLeft, currency)} />
          </div>
        )}

        <div className={`flex items-start gap-2 rounded-xl border p-3 ${toneCls}`}>
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{verdict.title}</p>
            <p className="opacity-90">{verdict.msg}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>Close</Button>
          <Button onClick={() => setChecked(true)} disabled={amount <= 0}>Check Now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium tabular-nums">
        <span className="text-muted-foreground line-through opacity-70">{before}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span>{after}</span>
      </span>
    </div>
  );
}
