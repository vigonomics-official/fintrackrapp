import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import * as Icons from "lucide-react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCategories, type Category } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/finance/PageHeader";
import { ExpensesTabs } from "@/components/finance/ExpensesTabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Categories — FinTrackr" },
      { name: "description", content: "Organize expenses with custom categories, icons, and colors." },
      { property: "og:title", content: "Categories — FinTrackr" },
      { property: "og:description", content: "Organize expenses with custom categories, icons, and colors." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/categories" },
      { name: "twitter:title", content: "Categories — FinTrackr" },
      { name: "twitter:description", content: "Organize expenses with custom categories, icons, and colors." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/categories" }],
  }),
});

const COLORS = ["#0d7a5f", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#c9a84c"];

const ICON_OPTIONS = [
  "UtensilsCrossed", "Car", "ShoppingBag", "Receipt", "Heart", "Film",
  "GraduationCap", "Plane", "CreditCard", "Home", "Briefcase", "Laptop",
  "TrendingUp", "Gift", "Coffee", "Smartphone", "Zap", "Tag",
];

function Ico({ name, className }: { name: string; className?: string }) {
  const I = (Icons as any)[name] ?? Tag;
  return <I className={className} />;
}

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);

  const openNew = () => {
    setEditing(null); setName(""); setType("expense");
    setColor(COLORS[0]); setIcon(ICON_OPTIONS[0]); setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c); setName(c.name); setType(c.type);
    setColor(c.color || COLORS[0]); setIcon(c.icon || ICON_OPTIONS[0]); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    if (editing) {
      const { error } = await supabase.from("categories")
        .update({ name: name.trim(), color, icon })
        .eq("id", editing.id);
      if (error) return toast.error(friendlyError(error));
      toast.success("Category updated");
    } else {
      const { error } = await supabase.from("categories").insert({
        user_id: user.id, name: name.trim(), type, color, icon,
      });
      if (error) return toast.error(friendlyError(error));
      toast.success("Category added");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (c: Category) => {
    if (c.is_default) return toast.error("Default categories can't be deleted");
    if (!confirm(`Delete "${c.name}"? Transactions will become uncategorized.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const grouped = (t: "income" | "expense") => categories.filter(c => c.type === t);

  return (
    <div>
      <ExpensesTabs />
      <PageHeader
        title="Categories"
        subtitle="Simple buckets for your money."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" />New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Food" />
                </div>
                {!editing && (
                  <div>
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Icon</Label>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {ICON_OPTIONS.map((n) => (
                      <button key={n} type="button" onClick={() => setIcon(n)}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-lg border text-foreground transition",
                          icon === n ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                        )}>
                        <Ico name={n} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)}
                        className={cn("h-8 w-8 rounded-lg transition", color === c && "ring-2 ring-offset-2 ring-primary")}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary">{editing ? "Update" : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 px-5 py-5 md:grid-cols-2 md:px-10">
        {(["expense", "income"] as const).map((t) => (
          <Card key={t} className="shadow-soft">
            <CardContent className="p-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t === "expense" ? "Spending" : "Income"}
              </h2>
              <ul className="mt-2 space-y-1">
                {grouped(t).map(c => (
                  <li key={c.id} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ background: c.color }}
                      >
                        <Ico name={c.icon} className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {c.is_default && (
                        <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                          default
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      {!c.is_default && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(c)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
