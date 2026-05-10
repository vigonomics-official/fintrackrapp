import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Trash2, MessageCircle, ArrowUpRight, ArrowDownLeft, Receipt, CheckCircle2, Search,
  HandCoins, Split as SplitIcon, Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/finance/PageHeader";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/split-settle")({ component: SplitSettle });

interface Friend { id: string; name: string; phone?: string; }
interface Split {
  id: string;
  friendId: string;
  description: string;
  amount: number; // positive = friend owes you, negative = you owe friend
  date: string;
  settled: boolean;
}

const KEY_F = "fintrackr_split_friends_v1";
const KEY_S = "fintrackr_splits_v1";

function load<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) { if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v)); }

function avatarColor(name: string) {
  const palette = ["bg-primary/15 text-primary", "bg-success/15 text-success", "bg-gold/15 text-gold-foreground", "bg-destructive/15 text-destructive", "bg-info/15 text-info"];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function SplitSettle() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [friends, setFriends] = useState<Friend[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [q, setQ] = useState("");
  const [openFriend, setOpenFriend] = useState(false);
  const [openSplit, setOpenSplit] = useState(false);
  const [splitDirection, setSplitDirection] = useState<"owes" | "owe">("owes");
  const [fabSheet, setFabSheet] = useState(false);

  useEffect(() => { setFriends(load(KEY_F, [])); setSplits(load(KEY_S, [])); }, []);
  useEffect(() => { save(KEY_F, friends); }, [friends]);
  useEffect(() => { save(KEY_S, splits); }, [splits]);

  // Context-aware FAB: open quick actions sheet
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as { intent?: string } | undefined;
      if (detail?.intent === "lend" && friends.length > 0) { setSplitDirection("owes"); setOpenSplit(true); }
      else if (detail?.intent === "split" && friends.length > 0) { setSplitDirection("owes"); setOpenSplit(true); }
      else setFabSheet(true);
    };
    window.addEventListener("fintrackr:fab", h);
    return () => window.removeEventListener("fintrackr:fab", h);
  }, [friends.length]);

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    splits.filter(s => !s.settled).forEach(s => map.set(s.friendId, (map.get(s.friendId) ?? 0) + s.amount));
    return map;
  }, [splits]);

  const totals = useMemo(() => {
    let owedToYou = 0, youOwe = 0;
    balances.forEach((v) => { if (v > 0) owedToYou += v; else youOwe += -v; });
    return { owedToYou, youOwe, net: owedToYou - youOwe };
  }, [balances]);

  const filteredFriends = friends.filter(f => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  function addFriend(name: string, phone?: string) {
    if (!name.trim()) return;
    setFriends(prev => [{ id: crypto.randomUUID(), name: name.trim(), phone }, ...prev]);
  }
  function addSplit(s: Omit<Split, "id" | "settled">) {
    setSplits(prev => [{ ...s, id: crypto.randomUUID(), settled: false }, ...prev]);
    toast.success("Split added");
  }
  function settleAll(friendId: string) {
    setSplits(prev => prev.map(s => s.friendId === friendId ? { ...s, settled: true } : s));
    toast.success("Marked as settled");
  }
  function removeSplit(id: string) { setSplits(prev => prev.filter(s => s.id !== id)); }
  function whatsappRemind(f: Friend, bal: number) {
    const msg = bal > 0
      ? `Hey ${f.name}! Just a friendly reminder — you owe me ${formatCurrency(bal, currency)}. Whenever convenient 🙂`
      : `Hey ${f.name}! I owe you ${formatCurrency(-bal, currency)} — sending it across.`;
    const url = f.phone
      ? `https://wa.me/${f.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Split & Settle"
        subtitle="Shared expenses with friends & family"
        action={
          <div className="flex gap-2">
            <Dialog open={openFriend} onOpenChange={setOpenFriend}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5"><Users className="h-4 w-4" /> Friend</Button>
              </DialogTrigger>
              <AddFriendDialog onAdd={(n, p) => { addFriend(n, p); setOpenFriend(false); }} />
            </Dialog>
            <Dialog open={openSplit} onOpenChange={setOpenSplit}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" disabled={friends.length === 0}><Plus className="h-4 w-4" /> Split</Button>
              </DialogTrigger>
              <AddSplitDialog friends={friends} onAdd={(s) => { addSplit(s); setOpenSplit(false); }} currency={currency} initialDirection={splitDirection} />
            </Dialog>
          </div>
        }
      />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* Net balance hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Net balance</p>
                <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl">
                  {totals.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(totals.net), currency)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white/10 p-2.5 backdrop-blur">
                    <p className="opacity-70">You're owed</p>
                    <p className="mt-1 font-display text-base font-semibold">{formatCurrency(totals.owedToYou, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-2.5 backdrop-blur">
                    <p className="opacity-70">You owe</p>
                    <p className="mt-1 font-display text-base font-semibold">{formatCurrency(totals.youOwe, currency)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {friends.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-base font-semibold">Add your first friend</p>
                <p className="mt-1 text-xs text-muted-foreground">Start tracking shared expenses, group bills and pending payments.</p>
              </div>
              <Button onClick={() => setOpenFriend(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add friend</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search friends" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {filteredFriends.map((f) => {
                  const bal = balances.get(f.id) ?? 0;
                  const friendSplits = splits.filter(s => s.friendId === f.id && !s.settled);
                  return (
                    <motion.div key={f.id} layout
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card className="shadow-soft transition-shadow hover:shadow-elegant">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(f.name)}`}>
                              {f.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{f.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {bal === 0 ? "All settled" : bal > 0 ? "owes you" : "you owe"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-display text-base font-bold tabular-nums ${bal > 0 ? "text-success" : bal < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {bal === 0 ? "—" : `${bal > 0 ? "+" : "−"}${formatCurrency(Math.abs(bal), currency)}`}
                              </p>
                            </div>
                          </div>

                          {friendSplits.length > 0 && (
                            <ul className="space-y-1.5 border-t pt-3">
                              {friendSplits.slice(0, 4).map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {s.amount > 0 ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-success" /> : <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                                    <span className="truncate">{s.description || "Untitled"}</span>
                                    <span className="text-muted-foreground">· {new Date(s.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="tabular-nums font-medium">{formatCurrency(Math.abs(s.amount), currency)}</span>
                                    <button onClick={() => removeSplit(s.id)} className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          {bal !== 0 && (
                            <div className="flex gap-2 border-t pt-3">
                              <Button size="sm" variant="outline" className="flex-1 gap-1.5"
                                onClick={() => whatsappRemind(f, bal)}>
                                <MessageCircle className="h-3.5 w-3.5" /> Remind
                              </Button>
                              <Button size="sm" className="flex-1 gap-1.5" onClick={() => settleAll(f.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Settle
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}

        {splits.filter(s => s.settled).length > 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" /> Settled history · {splits.filter(s => s.settled).length}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
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
        <Button onClick={() => name.trim() && onAdd(name, phone || undefined)}>Add</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddSplitDialog({ friends, onAdd, currency }: { friends: Friend[]; onAdd: (s: Omit<Split, "id" | "settled">) => void; currency: string }) {
  const [friendId, setFriendId] = useState(friends[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"owes" | "owe">("owes");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add a split</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Friend</Label>
          <select value={friendId} onChange={(e) => setFriendId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            {friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner at Indigo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount ({currency})</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant={direction === "owes" ? "default" : "outline"} className="flex-1" onClick={() => setDirection("owes")}>Owes me</Button>
              <Button type="button" size="sm" variant={direction === "owe" ? "default" : "outline"} className="flex-1" onClick={() => setDirection("owe")}>I owe</Button>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => {
          const a = Number(amount);
          if (!friendId || !a) return;
          onAdd({ friendId, description, amount: direction === "owes" ? a : -a, date: new Date().toISOString() });
        }}>Add split</Button>
      </DialogFooter>
    </DialogContent>
  );
}
