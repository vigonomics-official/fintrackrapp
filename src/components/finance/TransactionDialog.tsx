import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCategories, type Transaction } from "@/hooks/use-finance";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.coerce.number().positive("Must be positive"),
  category_id: z.string().optional(),
  payment_method: z.enum(["cash", "bank", "upi", "credit_card", "debit_card", "wallet"]),
  transaction_date: z.string(),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

const QUICK_CATS: { emoji: string; name: string; match: string[] }[] = [
  { emoji: "🍔", name: "Food", match: ["food", "dining", "restaurant"] },
  { emoji: "🛒", name: "Grocery", match: ["grocery", "groceries"] },
  { emoji: "🚗", name: "Transport", match: ["transport", "travel", "cab", "taxi"] },
  { emoji: "⛽", name: "Fuel", match: ["fuel", "petrol", "gas"] },
  { emoji: "🏠", name: "Rent", match: ["rent", "housing"] },
  { emoji: "⚡", name: "Bills", match: ["bill", "utilities", "utility"] },
  { emoji: "💳", name: "EMI", match: ["emi", "loan"] },
  { emoji: "💊", name: "Health", match: ["health", "medical", "medicine", "pharmacy"] },
  { emoji: "🛍️", name: "Shopping", match: ["shopping", "shop"] },
  { emoji: "🎬", name: "Fun", match: ["fun", "entertainment", "movie"] },
  { emoji: "👨‍👩‍👧", name: "Family", match: ["family", "kids"] },
  { emoji: "📦", name: "Other", match: ["other", "misc", "miscellaneous"] },
];

export function TransactionDialog({
  open, onOpenChange, edit,
}: { open: boolean; onOpenChange: (v: boolean) => void; edit?: Transaction }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      amount: undefined as unknown as number,
      payment_method: "cash",
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const watchType = form.watch("type");
  const selectedCategoryId = form.watch("category_id");

  useEffect(() => {
    if (open) {
      if (edit) {
        form.reset({
          type: edit.type,
          amount: edit.amount,
          category_id: edit.category_id ?? undefined,
          payment_method: edit.payment_method as any,
          transaction_date: edit.transaction_date,
          notes: edit.notes ?? "",
        });
      } else {
        form.reset({
          type: "expense",
          amount: undefined as unknown as number,
          payment_method: "cash",
          transaction_date: new Date().toISOString().slice(0, 10),
          notes: "",
        });
      }
      // Auto-focus amount field on open
      setTimeout(() => amountRef.current?.focus(), 60);
    }
  }, [open, edit, form]);

  const filteredCats = categories.filter((c) => watchType === "transfer" || c.type === watchType);

  const findCategoryId = (quick: typeof QUICK_CATS[number]): string | undefined => {
    const lower = quick.match;
    const found = filteredCats.find((c) => {
      const n = c.name.toLowerCase();
      return lower.some((k) => n === k || n.includes(k));
    });
    return found?.id;
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    setSubmitting(true);
    const payload = {
      user_id: user.id,
      type: values.type,
      amount: values.amount,
      category_id: values.category_id || null,
      payment_method: values.payment_method,
      transaction_date: values.transaction_date,
      notes: values.notes?.trim() || null,
      tags: edit?.tags ?? [],
    };
    const op = edit
      ? supabase.from("transactions").update(payload).eq("id", edit.id)
      : supabase.from("transactions").insert(payload);
    const { error } = await op;
    setSubmitting(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(edit ? "Transaction updated" : "Transaction added");
    qc.invalidateQueries({ queryKey: ["transactions"] });
    onOpenChange(false);
  });

  const { ref: amountRegisterRef, ...amountRegister } = form.register("amount");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>Track money in, out, or moved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["expense", "income", "transfer"] as const).map((t) => (
              <button type="button" key={t}
                onClick={() => form.setValue("type", t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                  watchType === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                }`}>{t}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                autoFocus
                {...amountRegister}
                ref={(el) => {
                  amountRegisterRef(el);
                  amountRef.current = el;
                }}
              />
              {form.formState.errors.amount && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" {...form.register("transaction_date")} />
            </div>
          </div>

          <div>
            <Label>Category</Label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {QUICK_CATS.map((q) => {
                const id = findCategoryId(q);
                const selected = id && selectedCategoryId === id;
                return (
                  <button
                    type="button"
                    key={q.name}
                    onClick={() => id && form.setValue("category_id", id)}
                    disabled={!id}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs font-medium transition ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-transparent bg-muted text-foreground hover:bg-muted/70"
                    } ${!id ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-lg leading-none">{q.emoji}</span>
                    <span className="mt-1 truncate">{q.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Payment method</Label>
            <Select value={form.watch("payment_method")} onValueChange={(v) => form.setValue("payment_method", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} {...form.register("notes")} />
          </div>

          <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary shadow-elegant">
            {submitting ? "Saving…" : edit ? "Save changes" : "Add transaction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
