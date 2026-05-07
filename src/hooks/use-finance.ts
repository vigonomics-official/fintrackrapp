import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Profile = {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  currency: string;
};
export type Category = {
  id: string; user_id: string; name: string; type: "income" | "expense";
  icon: string; color: string; parent_id: string | null; is_default: boolean;
};
export type Transaction = {
  id: string; user_id: string; type: "income" | "expense" | "transfer";
  amount: number; category_id: string | null; subcategory: string | null;
  payment_method: string; notes: string | null; tags: string[];
  transaction_date: string; created_at: string;
};
export type Budget = {
  id: string; user_id: string; category_id: string | null;
  monthly_limit: number; month: string;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*")
        .order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
    },
  });
}

export function useBudgets(month: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budgets", user?.id, month],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").eq("month", month);
      if (error) throw error;
      return (data ?? []).map((b: any) => ({ ...b, monthly_limit: Number(b.monthly_limit) })) as Budget[];
    },
  });
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export type LoanType = "home" | "personal" | "vehicle" | "education" | "gold" | "credit_card" | "informal" | "other";
export type Loan = {
  id: string; user_id: string; loan_name: string; loan_type: LoanType;
  total_amount: number; interest_rate: number; emi_amount: number;
  tenure_months: number; remaining_balance: number;
  start_date: string; due_day: number; notes: string | null;
  created_at: string; updated_at: string;
};
export type LoanPayment = {
  id: string; loan_id: string; user_id: string;
  payment_date: string; payment_amount: number; remaining_balance: number;
  payment_status: "paid" | "pending" | "missed"; created_at: string;
};

export function useLoans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("loans" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((l) => ({
        ...l,
        total_amount: Number(l.total_amount),
        interest_rate: Number(l.interest_rate),
        emi_amount: Number(l.emi_amount),
        remaining_balance: Number(l.remaining_balance),
      })) as Loan[];
    },
  });
}

export function useLoanPayments(loanId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loan_payments", user?.id, loanId ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("loan_payments" as any).select("*").order("payment_date", { ascending: false });
      if (loanId) q = q.eq("loan_id", loanId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        payment_amount: Number(p.payment_amount),
        remaining_balance: Number(p.remaining_balance),
      })) as LoanPayment[];
    },
  });
}
