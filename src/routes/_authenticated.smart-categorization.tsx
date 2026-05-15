import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Plus, Trash2, ShieldCheck, Brain, Store, Lightbulb,
  Check, X, Pencil, TrendingUp, Receipt, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PageHeader } from "@/components/finance/PageHeader";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useCategories, useTransactions } from "@/hooks/use-finance";
import {
  Rule, MerchantMemory, getRules, saveRules, getMemory, saveMemory,
  getDismissed, saveDismissed, predictCategory, normalizeMerchant,
  buildProfilesFromTransactions, rememberMerchant, forgetMerchant,
} from "@/lib/categorization";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/smart-categorization")({
  component: SmartCategorizationPage,
});

const FALLBACK_CATS = ["Food", "Dining", "Grocery", "Transport", "Fuel", "Shopping", "Subscription", "Recharge", "Bills", "Travel", "Health", "Entertainment", "Transfers", "Other"];

function SmartCategorizationPage() {
  const { data: categories = [] } = useCategories();
  const { data: txs = [] } = useTransactions();

  const [rules, setRules] = useState<Rule[]>(() => getRules());
  const [memory, setMemory] = useState<MerchantMemory[]>(() => getMemory());
  const [dismissed, setDismissed] = useState<string[]>(() => getDismissed());

  const [query, setQuery] = useState("");
  const [newRule, setNewRule] = useState({ match: "", category: "" });
  const [editing, setEditing] = useState<MerchantMemory | null>(null);
  const [editingCat, setEditingCat] = useState("");

  // Merge stored memory with derived merchants from real transactions
  const catNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  const derived = useMemo(() => buildProfilesFromTransactions(txs, catNameById), [txs, catNameById]);

  const merchants = useMemo<MerchantMemory[]>(() => {
    const map = new Map<string, MerchantMemory>();
    for (const m of derived) map.set(m.key, { ...m });
    for (const m of memory) {
      const cur = map.get(m.key);
      map.set(m.key, cur
        ? { ...cur, category: m.category, confirmed: m.confirmed || cur.confirmed, count: Math.max(cur.count, m.count), total: Math.max(cur.total, m.total) }
        : { ...m });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [derived, memory]);

  // Repeated unconfirmed merchants → suggestions
  const suggestions = useMemo(() => {
    return merchants
      .filter((m) => m.count >= 5 && !m.confirmed && !dismissed.includes(m.key))
      .slice(0, 10)
      .map((m) => ({ ...m, prediction: predictCategory(m.display || m.key, rules, memory) }));
  }, [merchants, rules, memory, dismissed]);

  // AI insights — derived purely from data
  const insights = useMemo(() => buildInsights(merchants), [merchants]);

  // ---------- Rules ----------
  const addRule = () => {
    const match = newRule.match.trim().toLowerCase();
    const category = newRule.category.trim();
    if (!match || !category) return toast.error("Add both keyword and category");
    if (rules.some((r) => r.match.toLowerCase() === match)) return toast.error("Rule already exists");
    const next = [...rules, { id: crypto.randomUUID(), match, category, source: "user" as const, hits: 0, createdAt: Date.now() }];
    setRules(next); saveRules(next);
    setNewRule({ match: "", category: "" });
    toast.success(`Rule added · ${match} → ${category}`);
  };
  const removeRule = (id: string) => {
    const next = rules.filter((r) => r.id !== id);
    setRules(next); saveRules(next);
  };

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rules.filter((r) => r.match.includes(q) || r.category.toLowerCase().includes(q)) : rules;
  }, [rules, query]);

  // ---------- Memory ----------
  const confirmMerchant = (m: MerchantMemory, category: string) => {
    rememberMerchant(m.display || m.key, category, m.total / Math.max(1, m.count), true);
    setMemory(getMemory());
    toast.success(`Saved · ${m.display} → ${category}`);
  };
  const ignoreSuggestion = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next); saveDismissed(next);
  };
  const resetMemory = () => {
    saveMemory([]); saveDismissed([]);
    setMemory([]); setDismissed([]);
    toast.success("Learned behaviour reset");
  };

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? merchants.filter((m) => (m.display || m.key).toLowerCase().includes(q) || m.category.toLowerCase().includes(q)) : merchants;
  }, [merchants, query]);

  const accuracy = useMemo(() => {
    if (merchants.length === 0) return 0;
    let known = 0;
    for (const m of merchants) {
      const p = predictCategory(m.display || m.key, rules, memory);
      if (p.category) known++;
    }
    return Math.round((known / merchants.length) * 100);
  }, [merchants, rules, memory]);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Smart Categorization" subtitle="Self-learning rules that organise your spends." />

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 md:px-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-soft sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Brain className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Self-learning engine</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">On-device</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  FinTrackr remembers your merchants and improves accuracy with every transaction. Rules and memory stay on this device.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Rules" value={String(rules.length)} />
          <Stat label="Merchants" value={String(merchants.length)} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
        </div>

        {/* Suggestions banner */}
        {suggestions.length > 0 && (
          <Card className="overflow-hidden border-primary/20 bg-primary/5 p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{suggestions.length} merchants ready to learn</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Tap suggestions below to save categories permanently.</p>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants, rules, categories" className="h-11 w-full rounded-xl pl-9" />
        </div>

        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="suggestions" className="text-xs">Suggest</TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">Rules</TabsTrigger>
            <TabsTrigger value="merchants" className="text-xs">Merchants</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs">Insights</TabsTrigger>
          </TabsList>

          {/* Suggestions */}
          <TabsContent value="suggestions" className="mt-4 space-y-3">
            {suggestions.length === 0 ? (
              <EmptyState icon={Sparkles} title="No suggestions yet" subtitle="Once a merchant appears 5+ times, we'll suggest a category here." />
            ) : (
              suggestions.map((s) => (
                <SuggestionCard
                  key={s.key}
                  merchant={s}
                  onSave={(cat) => confirmMerchant(s, cat)}
                  onIgnore={() => ignoreSuggestion(s.key)}
                />
              ))
            )}
          </TabsContent>

          {/* Rules */}
          <TabsContent value="rules" className="mt-4 space-y-3">
            <Card className="overflow-hidden shadow-soft">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b bg-muted/30 p-3">
                <Input placeholder="Keyword (e.g. swiggy)" value={newRule.match} onChange={(e) => setNewRule({ ...newRule, match: e.target.value })} className="h-9" />
                <Input placeholder="Category" value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} className="h-9" />
                <Button size="sm" onClick={addRule}><Plus className="h-4 w-4" /></Button>
              </div>
              <ul className="divide-y">
                {filteredRules.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">No rules match.</li>
                )}
                {filteredRules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Receipt className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          <span className="font-mono text-primary">{r.match}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{r.category}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.source === "seed" ? "Built-in" : r.source === "user" ? "Custom" : "Learned"} · {r.hits} hits
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(r.id)} className="h-8 w-8 shrink-0">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>

          {/* Merchants */}
          <TabsContent value="merchants" className="mt-4 space-y-3">
            {filteredMerchants.length === 0 ? (
              <EmptyState icon={Store} title="No merchants yet" subtitle="Add transactions and merchants will appear here." />
            ) : (
              <Card className="divide-y overflow-hidden shadow-soft">
                {filteredMerchants.slice(0, 50).map((m) => {
                  const pred = predictCategory(m.display || m.key, rules, memory);
                  return (
                    <div key={m.key} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-semibold">
                        {(m.display || m.key).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{m.display || m.key}</p>
                          {m.confirmed && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Saved</Badge>}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {m.count}× · {formatCurrency(m.total)} · {pred.via === "memory" ? "From memory" : pred.via === "rule" ? `Rule (${pred.confidence}%)` : "Uncategorized"}
                        </p>
                      </div>
                      <button
                        onClick={() => { setEditing(m); setEditingCat(m.category); }}
                        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
                      >
                        <span className="max-w-[80px] truncate">{m.category || "Set"}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    </div>
                  );
                })}
              </Card>
            )}
            {memory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={resetMemory} className="text-muted-foreground">
                Reset learned behaviour
              </Button>
            )}
          </TabsContent>

          {/* Insights */}
          <TabsContent value="insights" className="mt-4 space-y-3">
            {insights.length === 0 ? (
              <EmptyState icon={Lightbulb} title="No insights yet" subtitle="Insights appear once you have a few transactions." />
            ) : (
              insights.map((i, idx) => (
                <Card key={idx} className="flex items-start gap-3 p-4 shadow-soft">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <i.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">{i.body}</p>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <p className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Rules and merchant memory stay private on this device.
        </p>
      </div>

      {/* Edit merchant category dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="truncate">{editing?.display}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editingCat} onChange={(e) => setEditingCat(e.target.value)} placeholder="Category" />
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...categories.map((c) => c.name), ...FALLBACK_CATS])].slice(0, 14).map((c) => (
                <button
                  key={c}
                  onClick={() => setEditingCat(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    editingCat === c ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing?.confirmed && (
              <Button variant="ghost" onClick={() => { if (editing) { forgetMerchant(editing.key); setMemory(getMemory()); setEditing(null); toast.success("Forgot merchant"); } }}>
                Forget
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => { if (editing && editingCat.trim()) { confirmMerchant(editing, editingCat.trim()); setEditing(null); } }}>
              <Check className="mr-1 h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center shadow-soft">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof Sparkles; title: string; subtitle: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-8 text-center shadow-soft">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}

function SuggestionCard({
  merchant, onSave, onIgnore,
}: {
  merchant: MerchantMemory & { prediction: { category: string | null; confidence: number } };
  onSave: (cat: string) => void;
  onIgnore: () => void;
}) {
  const suggested = merchant.prediction.category ?? merchant.category;
  const options = [suggested, "Food", "Grocery", "Shopping", "Transport"].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 4) as string[];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-semibold">
            {(merchant.display || merchant.key).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{merchant.display || merchant.key}</p>
            <p className="text-[11px] text-muted-foreground">
              Seen {merchant.count}× · {formatCurrency(merchant.total)}
              {merchant.prediction.category && <> · {merchant.prediction.confidence}% match</>}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onIgnore} className="h-8 w-8">
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Save category permanently?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => onSave(c)}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Always {c}
            </button>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function buildInsights(merchants: MerchantMemory[]): { icon: typeof Sparkles; title: string; body: string }[] {
  if (merchants.length === 0) return [];
  const byCat = new Map<string, { count: number; total: number }>();
  for (const m of merchants) {
    const k = m.category || "Uncategorized";
    const cur = byCat.get(k) ?? { count: 0, total: 0 };
    cur.count += m.count; cur.total += m.total;
    byCat.set(k, cur);
  }
  const sorted = Array.from(byCat.entries()).sort((a, b) => b[1].total - a[1].total);
  const out: { icon: typeof Sparkles; title: string; body: string }[] = [];
  if (sorted.length > 0) {
    const [name, stats] = sorted[0];
    out.push({ icon: TrendingUp, title: `${name} leads your spends`, body: `${formatCurrency(stats.total)} across ${stats.count} transactions.` });
  }
  const top = merchants[0];
  if (top) out.push({ icon: Store, title: `${top.display || top.key} is your top merchant`, body: `${top.count} transactions · auto-categorized as ${top.category}.` });
  const learned = merchants.filter((m) => m.confirmed).length;
  if (learned > 0) out.push({ icon: Brain, title: `Learned ${learned} merchant${learned === 1 ? "" : "s"}`, body: `FinTrackr remembers these and applies them automatically.` });
  const subs = merchants.find((m) => m.category.toLowerCase().includes("subscription"));
  if (subs) out.push({ icon: Lightbulb, title: "Subscription spending detected", body: `Review your recurring services to spot waste.` });
  return out;
}
