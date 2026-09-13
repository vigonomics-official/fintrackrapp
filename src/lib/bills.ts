// Bills & subscriptions (Planner → Bills). Cloud-only, RLS-scoped to the
// signed-in user. Bills never create expense transactions.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Bill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
  created_at: string;
  updated_at: string;
};

export type BillInput = {
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
};

const KEY = "bills";

export function useBills() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: [KEY, user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        amount: Number(r.amount),
        due_day: Number(r.due_day),
      })) as Bill[];
    },
  });

  return {
    ...query,
    bills: (query.data ?? []) as Bill[],
    isLoading: authLoading || (!!user && query.isPending) || query.isLoading,
  };
}

export function useBillMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, user?.id] });

  const create = useMutation({
    mutationFn: async (input: BillInput) => {
      const { error } = await supabase
        .from("bills" as any)
        .insert({ ...input, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BillInput> }) => {
      const { error } = await supabase
        .from("bills" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
