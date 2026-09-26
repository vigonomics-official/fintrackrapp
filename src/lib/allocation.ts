// Salary allocation split (Planner → Allocate). Stored on the signed-in
// user's profile so it follows the account across devices.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type Alloc = { rent: number; food: number; travel: number; emi: number; savings: number; other: number };

export const DEFAULT_ALLOC: Alloc = { rent: 30, food: 15, travel: 10, emi: 20, savings: 20, other: 5 };

const KEY = "allocation";
const LEGACY_KEY = "fintrackr_alloc_v1";

function readLegacy(): Alloc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const ALLOC_KEYS = Object.keys(DEFAULT_ALLOC) as (keyof Alloc)[];

function normalize(raw: any): Alloc {
  if (!raw || typeof raw !== "object") return DEFAULT_ALLOC;
  const out = { ...DEFAULT_ALLOC };
  ALLOC_KEYS.forEach((k) => {
    const n = Number(raw[k]);
    if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(100, n));
    else if (k === "other") out[k] = 0;
  });
  return out;
}

function totalAllocation(alloc: Alloc) {
  return ALLOC_KEYS.reduce((sum, key) => sum + alloc[key], 0);
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
      if (!user) return DEFAULT_ALLOC;
      const { data, error } = await supabase
        .from("profiles")
        .select("allocation")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      const cloud = (data as any)?.allocation;
      if (cloud) {
        if (typeof window !== "undefined") localStorage.removeItem(LEGACY_KEY);
        return normalize(cloud);
      }
      // One-time lift of the device-only split into this account.
      const legacy = readLegacy();
      if (legacy) {
        await supabase.from("profiles").update({ allocation: legacy } as any).eq("id", user.id);
        if (typeof window !== "undefined") localStorage.removeItem(LEGACY_KEY);
        return legacy;
      }
      return DEFAULT_ALLOC;
    },
  });

  const save = useMutation({
    mutationFn: async (next: Alloc) => {
      if (!user) throw new Error("Sign in required to save allocation.");
      if (totalAllocation(next) > 100) throw new Error("Allocation cannot exceed 100%.");
      const { error } = await supabase
        .from("profiles")
        .update({ allocation: next } as any)
        .eq("id", user.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData([KEY, user?.id], next);
    },
    onError: () => {
      toast.error("Couldn't save your allocation. Please try again.");
      qc.invalidateQueries({ queryKey: [KEY, user?.id] });
    },
  });

  return {
    alloc: query.data ?? DEFAULT_ALLOC,
    isLoading: authLoading || (!!user && query.isPending) || query.isLoading,
    isLoaded: !!user && query.isSuccess,
    isError: query.isError,
    retry: () => query.refetch(),
    save: (next: Alloc) => {
      if (totalAllocation(next) > 100) return;
      qc.setQueryData([KEY, user?.id], next);
      save.mutate(next);
    },
  };
}
