import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Trash2, MessageCircle, ArrowUpRight, ArrowDownLeft, Receipt, CheckCircle2,
  HandCoins, Split as SplitIcon, Wallet, Calendar, AlertCircle, Clock, TrendingUp, MoreHorizontal,
  Pencil, Share2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/finance/PageHeader";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/split-settle")({
  component: SplitSettle,
  head: () => ({
    meta: [
      { title: "Split & Settle — FinTrackr" },
      { name: "description", content: "Split bills with friends and track who owes what." },
      { property: "og:title", content: "Split & Settle — FinTrackr" },
      { property: "og:description", content: "Split bills with friends and track who owes what." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/split-settle" },
      { name: "twitter:title", content: "Split & Settle — FinTrackr" },
      { name: "twitter:description", content: "Split bills with friends and track who owes what." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/split-settle" }],
  }),
});

type Kind = "lend" | "borrow" | "split";
type Status = "pending" | "partial" | "completed" | "overdue";

interface Friend { id: string; name: string; phone?: string; }
interface SplitEntry {
  id: string;
  kind: Kind;
  friendId: string;             // counter-party (for split: who paid OR primary member)
  description: string;
  amount: number;               // absolute, always positive
  repaid: number;               // cumulative repaid so far
  date: string;                 // ISO created
  dueDate?: string;             // ISO yyyy-mm-dd
  notes?: string;
  settled: boolean;
  // split-bill extras
  members?: string[];           // friendIds involved (excluding "you")
  paidByYou?: boolean;          // true => you paid, members owe you; false => paidBy friendId, you owe
}

const KEY_F = "fintrackr_split_friends_v1";
const KEY_S = "fintrackr_splits_v1";

function load<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) { if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v)); }

// Migrate any legacy entries (signed amount, no kind) into the new schema
function migrate(raw: any[]): SplitEntry[] {
  return raw.map((s) => {
    if (s.kind) return { repaid: 0, ...s } as SplitEntry;
    const amt = Number(s.amount) || 0;
    return {
      id: s.id ?? crypto.randomUUID(),
      kind: amt >= 0 ? "lend" : "borrow",
      friendId: s.friendId,
      description: s.description ?? "",
      amount: Math.abs(amt),
      repaid: 0,
      date: s.date ?? new Date().toISOString(),
      settled: !!s.settled,
    } as SplitEntry;
  });
}

function avatarColor(name: string) {
  const palette = ["bg-primary/15 text-primary", "bg-success/15 text-success", "bg-gold/15 text-gold-foreground", "bg-destructive/15 text-destructive", "bg-info/15 text-info"];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function statusOf(s: SplitEntry): Status {
  if (s.settled || s.repaid >= s.amount) return "completed";
  if (s.dueDate && new Date(s.dueDate) < new Date(new Date().toDateString())) return "overdue";
  if (s.repaid > 0) return "partial";
  return "pending";
}

function dueLabel(due?: string): string | null {
  if (!due) return null;
  const today = new Date(new Date().toDateString());
  const d = new Date(due);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `Overdue · ${-diff}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff}d`;
  return `Due ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function isThisMonth(iso: string) {
  const d = new Date(iso); const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function SplitSettle() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [friends, setFriends] = useState<Friend[]>([]);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [tab, setTab] = useState<"lent" | "borrowed" | "split" | "history">("lent");
  const [openFriend, setOpenFriend] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; kind: Kind; edit?: SplitEntry }>({ open: false, kind: "lend" });
  const [repayDialog, setRepayDialog] = useState<{ open: boolean; entry?: SplitEntry }>({ open: false });
  const [fabSheet, setFabSheet] = useState(false);

  useEffect(() => { setFriends(load(KEY_F, [])); setSplits(migrate(load(KEY_S, []))); }, []);
  useEffect(() => { save(KEY_F, friends); }, [friends]);
  useEffect(() => { save(KEY_S, splits); }, [splits]);

  // Context-aware FAB
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as { intent?: string } | undefined;
      if (friends.length === 0) { setOpenFriend(true); return; }
      if (detail?.intent === "lend") setEntryDialog({ open: true, kind: "lend" });
      else if (detail?.intent === "borrow") setEntryDialog({ open: true, kind: "borrow" });
      else if (detail?.intent === "split") setEntryDialog({ open: true, kind: "split" });
      else setFabSheet(true);
    };
    window.addEventListener("fintrackr:fab", h);
    return () => window.removeEventListener("fintrackr:fab", h);
  }, [friends.length]);

  const friendMap = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);

  const lent = splits.filter(s => s.kind === "lend" && !s.settled);
  const borrowed = splits.filter(s => s.kind === "borrow" && !s.settled);
  const splitBills = splits.filter(s => s.kind === "split" && !s.settled);
  const history = splits.filter(s => s.settled || s.repaid >= s.amount);

  const sum = (arr: SplitEntry[], f: (s: SplitEntry) => number) => arr.reduce((a, s) => a + f(s), 0);

  const stats = useMemo(() => {
    const lentTotal = sum(lent, s => s.amount);
    const lentRemaining = sum(lent, s => s.amount - s.repaid);
    const lentPeople = new Set(lent.filter(s => s.amount - s.repaid > 0).map(s => s.friendId)).size;
    const borrowedTotal = sum(borrowed, s => s.amount);
    const borrowedRemaining = sum(borrowed, s => s.amount - s.repaid);
    const upcomingDue = borrowed.filter(s => s.dueDate && (new Date(s.dueDate).getTime() - Date.now()) / 86400000 <= 7).length;
    const pendingIncoming = lentRemaining + sum(splitBills.filter(s => s.paidByYou !== false), s => s.amount - s.repaid);
    const pendingOutgoing = borrowedRemaining + sum(splitBills.filter(s => s.paidByYou === false), s => s.amount - s.repaid);
    const activeSettlements = lent.length + borrowed.length + splitBills.length;
    const monthSplits = splits.filter(s => isThisMonth(s.date));
    const monthMoved = sum(monthSplits, s => s.amount);
    const monthCompleted = monthSplits.filter(s => s.settled || s.repaid >= s.amount).length;
    const monthNewSplits = monthSplits.filter(s => s.kind === "split").length;
    const monthRepayments = monthSplits.filter(s => s.repaid > 0).length;
    return {
      lentTotal, lentRemaining, lentPeople,
      borrowedTotal, borrowedRemaining, upcomingDue,
      pendingIncoming, pendingOutgoing, activeSettlements,
      monthMoved, monthCompleted, monthNewSplits, monthRepayments,
    };
  }, [splits, lent, borrowed, splitBills]);

  function addFriend(name: string, phone?: string) {
    if (!name.trim()) return;
    setFriends(prev => [{ id: crypto.randomUUID(), name: name.trim(), phone }, ...prev]);
  }
  function upsertEntry(e: Omit<SplitEntry, "id" | "settled" | "repaid"> & { id?: string; repaid?: number }) {
    setSplits(prev => {
      if (e.id) return prev.map(s => s.id === e.id ? { ...s, ...e, id: s.id, settled: s.settled, repaid: e.repaid ?? s.repaid } : s);
      return [{ ...e, id: crypto.randomUUID(), settled: false, repaid: 0 }, ...prev];
    });
    toast.success(e.id ? "Updated" : "Added");
  }
  function recordRepayment(id: string, amt: number) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const repaid = Math.min(s.amount, s.repaid + amt);
      const settled = repaid >= s.amount;
      return { ...s, repaid, settled };
    }));
    toast.success("Repayment recorded");
  }
  function markComplete(id: string) {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, settled: true, repaid: s.amount } : s));
    toast.success("Marked complete");
  }
  function extendDue(id: string, days: number) {
    setSplits(prev => prev.map(s => {
      if (s.id !== id) return s;
      const base = s.dueDate ? new Date(s.dueDate) : new Date();
      base.setDate(base.getDate() + days);
      return { ...s, dueDate: base.toISOString().slice(0, 10) };
    }));
    toast.success(`Extended by ${days}d`);
  }
  function removeEntry(id: string) { setSplits(prev => prev.filter(s => s.id !== id)); }

  function whatsappRemind(e: SplitEntry) {
    const f = friendMap.get(e.friendId); if (!f) return;
    const remaining = e.amount - e.repaid;
    const msg = e.kind === "lend"
      ? `Hey ${f.name} 👋 Friendly reminder about ${formatCurrency(remaining, currency)} pending${e.description ? ` for ${e.description}` : ""}.`
      : e.kind === "borrow"
      ? `Hey ${f.name} — I'll settle ${formatCurrency(remaining, currency)} soon. Thanks for waiting 🙏`
      : `Hey ${f.name} 👋 Sharing the split for ${e.description || "our expense"} — your share: ${formatCurrency(remaining / Math.max(1, (e.members?.length ?? 1)), currency)}.`;
    const url = f.phone
      ? `https://wa.me/${f.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  const noFriends = friends.length === 0;

  return (
    <div>
      <PageHeader
        title="Split & Settle"
        subtitle="People money tracker · lent, borrowed & shared"
        action={
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpenFriend(true)}>
            <Users className="h-4 w-4" /> Friend
          </Button>
        }
      />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            tone="success"
            icon={ArrowDownLeft}
            label="You Lent"
            primary={formatCurrency(stats.lentRemaining, currency)}
            sub={`${formatCurrency(stats.lentTotal, currency)} total · ${stats.lentPeople} ${stats.lentPeople === 1 ? "person" : "people"}`}
          />
          <SummaryCard
            tone="destructive"
            icon={ArrowUpRight}
            label="You Borrowed"
            primary={formatCurrency(stats.borrowedRemaining, currency)}
            sub={`${formatCurrency(stats.borrowedTotal, currency)} total${stats.upcomingDue ? ` · ${stats.upcomingDue} due soon` : ""}`}
          />
          <SummaryCard
            tone="primary"
            icon={Wallet}
            label="Pending"
            primary={formatCurrency(stats.pendingIncoming - stats.pendingOutgoing, currency)}
            sub={`${stats.activeSettlements} active`}
            signed
          />
          <SummaryCard
            tone="gold"
            icon={TrendingUp}
            label="This Month"
            primary={formatCurrency(stats.monthMoved, currency)}
            sub={`${stats.monthCompleted} settled · ${stats.monthNewSplits} new`}
          />
        </div>

        {noFriends ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-base font-semibold">Add your first friend</p>
                <p className="mt-1 text-xs text-muted-foreground">Track lending, borrowing and split bills — privately, on your device.</p>
              </div>
              <Button onClick={() => setOpenFriend(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add friend</Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="lent">Lent</TabsTrigger>
              <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="lent" className="mt-4 space-y-3">
              <EntryList entries={lent} kind="lend" friendMap={friendMap} currency={currency}
                onRepay={(e) => setRepayDialog({ open: true, entry: e })}
                onRemind={whatsappRemind}
                onEdit={(e) => setEntryDialog({ open: true, kind: "lend", edit: e })}
                onComplete={markComplete}
                onRemove={removeEntry}
                emptyTitle="No active lending"
                emptyHint="Tap the + button to record money you've lent."
              />
            </TabsContent>

            <TabsContent value="borrowed" className="mt-4 space-y-3">
              <EntryList entries={borrowed} kind="borrow" friendMap={friendMap} currency={currency}
                onRepay={(e) => setRepayDialog({ open: true, entry: e })}
                onRemind={whatsappRemind}
                onEdit={(e) => setEntryDialog({ open: true, kind: "borrow", edit: e })}
                onComplete={markComplete}
                onRemove={removeEntry}
                onExtend={(e) => extendDue(e.id, 7)}
                emptyTitle="No active borrowings"
                emptyHint="Track money you owe with due-date reminders."
              />
            </TabsContent>

            <TabsContent value="split" className="mt-4 space-y-3">
              <EntryList entries={splitBills} kind="split" friendMap={friendMap} currency={currency}
                onRepay={(e) => setRepayDialog({ open: true, entry: e })}
                onRemind={whatsappRemind}
                onEdit={(e) => setEntryDialog({ open: true, kind: "split", edit: e })}
                onComplete={markComplete}
                onRemove={removeEntry}
                emptyTitle="No split bills"
                emptyHint="Add a shared expense and split it equally."
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {history.length === 0 ? (
                <EmptyTile icon={Receipt} title="No history yet" hint="Completed settlements appear here." />
              ) : (
                history.map((e) => {
                  const f = friendMap.get(e.friendId);
                  return (
                    <Card key={e.id} className="shadow-soft">
                      <CardContent className="flex items-center gap-3 p-4">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${avatarColor(f?.name ?? "?")}`}>
                          {(f?.name ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.description || (e.kind === "split" ? "Split bill" : e.kind === "lend" ? "Lent" : "Borrowed")}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{f?.name} · {new Date(e.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-sm font-bold tabular-nums">{formatCurrency(e.amount, currency)}</p>
                          <Badge variant="outline" className="mt-1 h-5 gap-1 border-success/30 bg-success/10 text-[10px] text-success">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Friend dialog */}
      <Dialog open={openFriend} onOpenChange={setOpenFriend}>
        <AddFriendDialog onAdd={(n, p) => { addFriend(n, p); setOpenFriend(false); }} />
      </Dialog>

      {/* Entry dialog */}
      <Dialog open={entryDialog.open} onOpenChange={(o) => setEntryDialog((s) => ({ ...s, open: o }))}>
        <EntryDialog
          kind={entryDialog.kind}
          edit={entryDialog.edit}
          friends={friends}
          currency={currency}
          onSubmit={(e) => { upsertEntry(e); setEntryDialog({ open: false, kind: entryDialog.kind }); }}
        />
      </Dialog>

      {/* Repay dialog */}
      <Dialog open={repayDialog.open} onOpenChange={(o) => setRepayDialog((s) => ({ ...s, open: o }))}>
        <RepayDialog
          entry={repayDialog.entry}
          currency={currency}
          onSubmit={(amt) => { if (repayDialog.entry) recordRepayment(repayDialog.entry.id, amt); setRepayDialog({ open: false }); }}
        />
      </Dialog>

      {/* FAB quick actions */}
      <Sheet open={fabSheet} onOpenChange={setFabSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Quick action</SheetTitle>
            <SheetDescription>Track lending, borrowing & split bills.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <FabTile icon={ArrowDownLeft} label="Add Lending" tone="bg-success/10 text-success"
              onClick={() => { setFabSheet(false); setEntryDialog({ open: true, kind: "lend" }); }} />
            <FabTile icon={ArrowUpRight} label="Add Borrowing" tone="bg-destructive/10 text-destructive"
              onClick={() => { setFabSheet(false); setEntryDialog({ open: true, kind: "borrow" }); }} />
            <FabTile icon={SplitIcon} label="Split Expense" tone="bg-primary/10 text-primary"
              onClick={() => { setFabSheet(false); setEntryDialog({ open: true, kind: "split" }); }} />
            <FabTile icon={HandCoins} label="Record Repayment" tone="bg-gold/15 text-gold-foreground"
              onClick={() => {
                setFabSheet(false);
                const active = splits.find(s => !s.settled && s.repaid < s.amount);
                if (active) setRepayDialog({ open: true, entry: active });
                else toast.info("No active settlements");
              }} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function SummaryCard({ tone, icon: Icon, label, primary, sub, signed }: {
  tone: "success" | "destructive" | "primary" | "gold";
  icon: typeof Plus; label: string; primary: string; sub: string; signed?: boolean;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-foreground",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="shadow-soft transition-shadow hover:shadow-elegant">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          </div>
          <p className="font-display text-lg font-bold tabular-nums leading-tight">{signed && !primary.startsWith("-") ? `+${primary}` : primary}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Plus }> = {
    pending: { label: "Pending", cls: "border-muted-foreground/30 bg-muted text-muted-foreground", Icon: Clock },
    partial: { label: "Partial", cls: "border-info/30 bg-info/10 text-info", Icon: HandCoins },
    completed: { label: "Completed", cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
    overdue: { label: "Overdue", cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: AlertCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[10px] ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function EntryList({
  entries, kind, friendMap, currency,
  onRepay, onRemind, onEdit, onComplete, onRemove, onExtend,
  emptyTitle, emptyHint,
}: {
  entries: SplitEntry[]; kind: Kind;
  friendMap: Map<string, Friend>; currency: string;
  onRepay: (e: SplitEntry) => void;
  onRemind: (e: SplitEntry) => void;
  onEdit: (e: SplitEntry) => void;
  onComplete: (id: string) => void;
  onRemove: (id: string) => void;
  onExtend?: (e: SplitEntry) => void;
  emptyTitle: string; emptyHint: string;
}) {
  if (entries.length === 0) return <EmptyTile icon={kind === "lend" ? ArrowDownLeft : kind === "borrow" ? ArrowUpRight : SplitIcon} title={emptyTitle} hint={emptyHint} />;
  return (
    <AnimatePresence initial={false}>
      {entries.map((e) => {
        const f = friendMap.get(e.friendId);
        const remaining = Math.max(0, e.amount - e.repaid);
        const pct = e.amount > 0 ? Math.min(100, (e.repaid / e.amount) * 100) : 0;
        const status = statusOf(e);
        const due = dueLabel(e.dueDate);
        return (
          <motion.div key={e.id} layout
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="shadow-soft transition-shadow hover:shadow-elegant">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(f?.name ?? "?")}`}>
                    {(f?.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{f?.name ?? "Unknown"}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {kind === "split" ? (e.description || "Split bill") : (e.description || (kind === "lend" ? "Lent" : "Borrowed"))}
                      {kind === "split" && e.members && e.members.length > 0 && ` · ${e.members.length + 1} people`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-base font-bold tabular-nums ${kind === "lend" ? "text-success" : kind === "borrow" ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(remaining, currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">of {formatCurrency(e.amount, currency)}</p>
                  </div>
                </div>

                {/* Progress */}
                {e.repaid > 0 && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {/* Meta row */}
                {(due || e.notes) && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {due && <span className={`inline-flex items-center gap-1 ${status === "overdue" ? "text-destructive" : ""}`}>
                      <Calendar className="h-3 w-3" /> {due}
                    </span>}
                    {e.notes && <span className="truncate">· {e.notes}</span>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t pt-3">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => onRepay(e)}>
                    <HandCoins className="h-3.5 w-3.5" /> {kind === "borrow" ? "Pay" : "Repayment"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => onRemind(e)}>
                    <MessageCircle className="h-3.5 w-3.5" /> {kind === "split" ? "Share" : "Remind"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="px-2" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(e)}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                      {onExtend && <DropdownMenuItem onClick={() => onExtend(e)}><Calendar className="mr-2 h-3.5 w-3.5" /> Extend +7d</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => onComplete(e.id)}><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark complete</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRemove(e.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

function EmptyTile({ icon: Icon, title, hint }: { icon: typeof Plus; title: string; hint: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
        <p className="font-display text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function FabTile({ icon: Icon, label, tone, onClick }: { icon: typeof Plus; label: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft active:scale-[0.98]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function AddFriendDialog({ onAdd }: { onAdd: (name: string, phone?: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add friend</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rohan" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone (optional, for WhatsApp reminders)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => name.trim() && onAdd(name.trim(), phone || undefined)}>Add</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EntryDialog({
  kind, edit, friends, currency, onSubmit,
}: {
  kind: Kind;
  edit?: SplitEntry;
  friends: Friend[];
  currency: string;
  onSubmit: (e: Omit<SplitEntry, "id" | "settled" | "repaid"> & { id?: string }) => void;
}) {
  const [friendId, setFriendId] = useState(edit?.friendId ?? friends[0]?.id ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [amount, setAmount] = useState(edit?.amount ? String(edit.amount) : "");
  const [dueDate, setDueDate] = useState(edit?.dueDate ?? "");
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [members, setMembers] = useState<string[]>(edit?.members ?? []);
  const [paidByYou, setPaidByYou] = useState(edit?.paidByYou ?? true);

  const title = kind === "lend" ? "Add lending" : kind === "borrow" ? "Add borrowing" : "Split expense";

  function toggleMember(id: string) {
    setMembers((m) => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{edit ? `Edit ${kind}` : title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {kind !== "split" && (
          <div className="space-y-1.5">
            <Label>{kind === "lend" ? "Lent to" : "Borrowed from"}</Label>
            <select value={friendId} onChange={(e) => setFriendId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{kind === "split" ? "Bill name" : "Description"}</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={kind === "split" ? "e.g. Goa trip, Dinner" : "e.g. Travel cash"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount ({currency})</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{kind === "split" ? "Date" : "Due date"}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {kind === "split" && (
          <>
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant={paidByYou ? "default" : "outline"} className="flex-1" onClick={() => setPaidByYou(true)}>You</Button>
                <Button type="button" size="sm" variant={!paidByYou ? "default" : "outline"} className="flex-1" onClick={() => setPaidByYou(false)}>Friend</Button>
              </div>
            </div>
            {!paidByYou && (
              <div className="space-y-1.5">
                <Label>Who paid?</Label>
                <select value={friendId} onChange={(e) => setFriendId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Split between ({members.length + 1} {members.length === 0 ? "person" : "people"})</Label>
              <div className="flex flex-wrap gap-1.5">
                {friends.map(f => (
                  <button key={f.id} type="button" onClick={() => toggleMember(f.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${members.includes(f.id) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}>
                    {f.name}
                  </button>
                ))}
              </div>
              {Number(amount) > 0 && members.length > 0 && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Equal split · {formatCurrency(Number(amount) / (members.length + 1), currency)} each
                </p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any reference, UPI ref…" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => {
          const a = Number(amount);
          if (!a || a <= 0) { toast.error("Enter a valid amount"); return; }
          if (kind === "split" && !paidByYou && !friendId) { toast.error("Select who paid"); return; }
          if (kind !== "split" && !friendId) { toast.error("Select a friend"); return; }
          onSubmit({
            id: edit?.id,
            kind,
            friendId: kind === "split" ? (paidByYou ? (members[0] ?? friends[0]?.id ?? "") : friendId) : friendId,
            description,
            amount: a,
            date: edit?.date ?? new Date().toISOString(),
            dueDate: dueDate || undefined,
            notes: notes || undefined,
            members: kind === "split" ? members : undefined,
            paidByYou: kind === "split" ? paidByYou : undefined,
          });
        }}>{edit ? "Save" : "Add"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RepayDialog({ entry, currency, onSubmit }: { entry?: SplitEntry; currency: string; onSubmit: (amt: number) => void }) {
  const remaining = entry ? Math.max(0, entry.amount - entry.repaid) : 0;
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  useEffect(() => { setAmount(remaining ? String(remaining) : ""); }, [remaining]);
  if (!entry) return <DialogContent><DialogHeader><DialogTitle>Record repayment</DialogTitle></DialogHeader></DialogContent>;
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record repayment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Card className="border-0 bg-muted/40 shadow-none">
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Remaining</p>
            <p className="font-display text-lg font-bold tabular-nums">{formatCurrency(remaining, currency)}</p>
          </CardContent>
        </Card>
        <div className="space-y-1.5">
          <Label>Amount ({currency})</Label>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {[0.25, 0.5, 1].map((f) => (
            <Button key={f} type="button" size="sm" variant="outline" className="flex-1"
              onClick={() => setAmount(String((remaining * f).toFixed(2)))}>
              {f === 1 ? "Full" : `${Math.round(f * 100)}%`}
            </Button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => { const a = Number(amount); if (a > 0) onSubmit(a); }}>Record</Button>
      </DialogFooter>
    </DialogContent>
  );
}
