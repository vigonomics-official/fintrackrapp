// Purchase List (Planner → Buy). Cloud-only, RLS-scoped to the signed-in user.
// Saving an item here NEVER creates an expense transaction.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const PURCHASE_CATEGORIES = [
  "Electronics", "Phone", "Laptop", "Gadgets", "Shopping", "Grocery",
  "Home", "Travel", "Education", "Health", "Other",
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

export const PURCHASE_PRIORITIES = ["High", "Medium", "Low"] as const;
export type PurchasePriority = (typeof PURCHASE_PRIORITIES)[number];

export type PurchaseStatus = "planned" | "purchased";

export type PurchaseItem = {
  id: string;
  user_id: string;
  item_name: string;
  estimated_price: number;
  category: string;
  priority: string;
  target_date: string | null;
  notes: string | null;
  status: PurchaseStatus;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseItemInput = {
  item_name: string;
  estimated_price: number;
  category: string;
  priority: string;
  target_date: string | null;
  notes: string | null;
};

const KEY = "purchase_list";

export function usePurchaseList() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: [KEY, user?.id],
    enabled: !!user,
    // Always re-read on mount so returning to Planner → Buy shows the latest
    // list instead of a cached/empty result from before the session hydrated.
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_list" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        estimated_price: Number(r.estimated_price),
      })) as PurchaseItem[];
    },
  });

  // While the session is still resolving the query is disabled, which would
  // otherwise look like "no items" instead of "still loading".
  return {
    ...query,
    isLoading: authLoading || (!!user && query.isPending) || query.isLoading,
  };
}

export function usePurchaseListMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, user?.id] });

  const create = useMutation({
    mutationFn: async (input: PurchaseItemInput) => {
      const { error } = await supabase
        .from("purchase_list" as any)
        .insert({ ...input, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PurchaseItem> }) => {
      const { error } = await supabase
        .from("purchase_list" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_list" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
