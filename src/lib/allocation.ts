// Salary allocation split (Planner → Allocate). Stored on the signed-in
// user's profile so it follows the account across devices.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Alloc = { rent: number; food: number; travel: number; emi: number; savings: number };

export const DEFAULT_ALLOC: Alloc = { rent: 30, food: 15, travel: 10, emi: 20, savings: 20 };

const KEY = "allocation";

function normalize(raw: any): Alloc {
  if (!raw || typeof raw !== "object") return DEFAULT_ALLOC;
  const out = { ...DEFAULT_ALLOC };
  (Object.keys(DEFAULT_ALLOC) as (keyof Alloc)[]).forEach((k) => {
    const n = Number(raw[k]);
    if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(100, n));
  });
  return out;
}

export function useAllocation() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("allocation")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return normalize((data as any)?.allocation);
    },
  });

  const save = useMutation({
    mutationFn: async (next: Alloc) => {
      const { error } = await supabase
        .from("profiles")
        .update({ allocation: next } as any)
        .eq("id", user!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData([KEY, user?.id], next);
    },
  });

  return {
    alloc: query.data ?? DEFAULT_ALLOC,
    isLoading: authLoading || (!!user && query.isPending) || query.isLoading,
    save: (next: Alloc) => {
      qc.setQueryData([KEY, user?.id], next);
      save.mutate(next);
    },
  };
}
