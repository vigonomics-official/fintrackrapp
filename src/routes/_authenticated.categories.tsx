import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { useCategories } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/categories")({ component: CategoriesPage });

const COLORS = ["#0d7a5f", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#c9a84c"];

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState(COLORS[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("categories").insert({
      user_id: user.id, name: name.trim(), type, color,
    });
    if (error) return toast.error(error.message);
    toast.success("Category added");
    setName(""); setOpen(false);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category? Transactions will be uncategorized.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const grouped = (t: "income" | "expense") => categories.filter(c => c.type === t);

  return (
    <div>
      <PageHeader title="Categories" subtitle="Organize transactions your way."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
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
                <div>
                  <Label>Color</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)}
                        className={`h-8 w-8 rounded-lg transition ${color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 px-6 py-6 md:grid-cols-2 md:px-10">
        {(["expense", "income"] as const).map((t) => (
          <Card key={t} className="shadow-soft">
            <CardContent className="p-5">
              <h2 className="font-display text-lg font-semibold capitalize">{t}</h2>
              <ul className="mt-3 space-y-1">
                {grouped(t).map(c => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                    <span className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.is_default && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">default</span>}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
