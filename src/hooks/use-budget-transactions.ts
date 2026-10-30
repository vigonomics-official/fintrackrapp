import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Transaction } from "@/hooks/use-finance";
import { shiftMonth } from "@/lib/budget";

// Keep the transactions prefix so existing add/edit/delete invalidation refreshes budgets.
// Fetch every row in the selected month and its suggestion window, not the shared 1000-row feed.
export function useBudgetTransactions(month: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id, "budget", month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const rows: Transaction[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("transactions").select("*")
          .eq("user_id", user.id)
          .gte("transaction_date", shiftMonth(month, -3))
          .lt("transaction_date", shiftMonth(month, 1))
          .order("transaction_date").order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data ?? []).map(t => ({ ...t, amount: Number(t.amount) })));
        if (!data || data.length < 500) return rows;
      }
    },
  });
}