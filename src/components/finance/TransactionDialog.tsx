import { useEffect, useState } from "react";
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
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function TransactionDialog({
  open, onOpenChange, edit,
}: { open: boolean; onOpenChange: (v: boolean) => void; edit?: Transaction }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      amount: undefined as unknown as number,
      payment_method: "cash",
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "",
      tags: "",
    },
  });

  const watchType = form.watch("type");

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
          tags: edit.tags.join(", "),
        });
      } else {
        form.reset({
          type: "expense",
          amount: undefined as unknown as number,
          payment_method: "cash",
          transaction_date: new Date().toISOString().slice(0, 10),
          notes: "", tags: "",
        });
      }
    }
  }, [open, edit, form]);

  const filteredCats = categories.filter((c) => watchType === "transfer" || c.type === watchType);

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
      tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
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
              <Input type="number" step="0.01" min="0" {...form.register("amount")} />
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
            <Select value={form.watch("category_id") ?? ""} onValueChange={(v) => form.setValue("category_id", v)}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Tags (comma separated)</Label>
            <Input placeholder="groceries, weekly" {...form.register("tags")} />
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
