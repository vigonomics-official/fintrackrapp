import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, ShoppingBag, ChevronDown, ChevronRight, CheckCircle2, RotateCcw, CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-finance";
import {
  usePurchaseList, usePurchaseListMutations, PURCHASE_CATEGORIES, PURCHASE_PRIORITIES,
  type PurchaseItem,
} from "@/lib/purchase-list";

const PRIORITY_TONE: Record<string, string> = {
  High: "border-destructive/30 bg-destructive/10 text-destructive",
  Medium: "border-gold/30 bg-gold/10 text-gold-foreground",
  Low: "border-border bg-muted text-muted-foreground",
};

type FormState = {
  item_name: string; estimated_price: string; category: string;
  priority: string; target_date: string; notes: string;
};

const EMPTY: FormState = {
  item_name: "", estimated_price: "", category: "Other",
  priority: "Medium", target_date: "", notes: "",
};

export function PurchaseListSection({
  onCheck,
}: {
  onCheck: (item: PurchaseItem) => void;
}) {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const { data: items = [], isLoading } = usePurchaseList();
  const { create, update, remove } = usePurchaseListMutations();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPurchased, setShowPurchased] = useState(false);

  const planned = useMemo(() => items.filter((i) => i.status !== "purchased"), [items]);
  const purchased = useMemo(() => items.filter((i) => i.status === "purchased"), [items]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(it: PurchaseItem) {
    setEditing(it);
    setForm({
      item_name: it.item_name,
      estimated_price: String(it.estimated_price ?? ""),
      category: it.category || "Other",
      priority: it.priority || "Medium",
      target_date: it.target_date ?? "",
      notes: it.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    const name = form.item_name.trim();
    const price = Number(form.estimated_price);
    if (!name) return toast.error("Item name is required");
    if (!Number.isFinite(price) || price <= 0) return toast.error("Enter a valid estimated price");

    const payload = {
      item_name: name,
      estimated_price: price,
      category: form.category,
      priority: form.priority,
      target_date: form.target_date || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Purchase updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Added to your purchase list");
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
    } catch {
      toast.error("Could not save. Please try again.");
    }
  }

  async function setStatus(it: PurchaseItem, status: "planned" | "purchased") {
    try {
      await update.mutateAsync({
        id: it.id,
        patch: { status, purchased_at: status === "purchased" ? new Date().toISOString() : null },
      });
      toast.success(status === "purchased" ? "Marked as purchased" : "Moved back to planned");
    } catch {
      toast.error("Could not update. Please try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success("Removed from your purchase list");
    } catch {
      toast.error("Could not delete. Please try again.");
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-display text-base font-bold">My Purchase List</h2>
        <p className="text-xs text-muted-foreground">
          Save things you want to buy and check them when you're ready.
        </p>
      </div>

      {planned.length === 0 && purchased.length === 0 && !isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            <p className="font-display text-sm font-bold">No purchase plans yet</p>
            <p className="text-xs text-muted-foreground">
              Add something you want to buy and check if it fits your budget.
            </p>
            <Button size="sm" className="mt-1 gap-1" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add to Purchase List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Button className="w-full gap-1" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add to Purchase List
          </Button>

          <div className="space-y-2.5">
            {planned.map((it) => (
              <ItemCard
                key={it.id}
                it={it}
                currency={currency}
                onCheck={() => onCheck(it)}
                onEdit={() => openEdit(it)}
                onDelete={() => setDeleteId(it.id)}
                onStatus={() => setStatus(it, "purchased")}
              />
            ))}
          </div>

          {purchased.length > 0 && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setShowPurchased((v) => !v)}
                className="flex w-full items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs font-medium"
              >
                {showPurchased ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Purchased ({purchased.length})
              </button>
              {showPurchased &&
                purchased.map((it) => (
                  <ItemCard
                    key={it.id}
                    it={it}
                    currency={currency}
                    purchasedView
                    onCheck={() => onCheck(it)}
                    onEdit={() => openEdit(it)}
                    onDelete={() => setDeleteId(it.id)}
                    onStatus={() => setStatus(it, "planned")}
                  />
                ))}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Planned purchases are only a wish list — they never count as expenses or reduce your salary left.
      </p>

      {/* Add / edit form */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">
              {editing ? "Edit purchase" : "Add to Purchase List"}
            </SheetTitle>
            <SheetDescription>Saving this does not create an expense.</SheetDescription>
          </SheetHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-name" className="text-xs">Item name *</Label>
              <Input id="pl-name" placeholder="e.g. iPhone 15"
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-price" className="text-xs">Estimated price ({currency}) *</Label>
              <Input id="pl-price" type="number" inputMode="decimal" placeholder="45000"
                value={form.estimated_price}
                onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURCHASE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURCHASE_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-date" className="text-xs">Target date (optional)</Label>
              <Input id="pl-date" type="date" value={form.target_date}
                onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-notes" className="text-xs">Notes (optional)</Label>
              <Textarea id="pl-notes" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save} disabled={create.isPending || update.isPending}>
              {editing ? "Save changes" : "Add to Purchase List"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your purchase list permanently. Your expenses are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemCard({
  it, currency, onCheck, onEdit, onDelete, onStatus, purchasedView = false,
}: {
  it: PurchaseItem; currency: string; purchasedView?: boolean;
  onCheck: () => void; onEdit: () => void; onDelete: () => void; onStatus: () => void;
}) {
  return (
    <Card className={cn("shadow-soft", purchasedView && "opacity-80")}>
      <CardContent className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">{it.item_name}</p>
            <p className="text-base font-bold tabular-nums text-primary">
              {formatCurrency(it.estimated_price, currency)}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            PRIORITY_TONE[it.priority] ?? PRIORITY_TONE["Low"])}>
            {it.priority}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{it.category}</span>
          {it.target_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(it.target_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          <span>{purchasedView ? "Purchased" : "Planned"}</span>
        </div>

        {it.notes && <p className="text-[11px] text-muted-foreground">{it.notes}</p>}

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={onCheck}>
            <ShoppingBag className="h-3.5 w-3.5" /> Can I Buy?
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onStatus}>
            {purchasedView
              ? <><RotateCcw className="h-3.5 w-3.5" /> Planned</>
              : <><CheckCircle2 className="h-3.5 w-3.5" /> Purchased</>}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
