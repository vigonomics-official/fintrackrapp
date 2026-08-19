import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

function monthRange(month: string) {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export default defineTool({
  name: "spending_summary",
  title: "Spending summary",
  description:
    "Summarise the signed-in user's income, expenses and net balance for a month, broken down by category.",
  inputSchema: {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Month in YYYY-MM format. Defaults to the current month."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const target = month ?? new Date().toISOString().slice(0, 7);
    const { start, end } = monthRange(target);
    const supabase = supabaseForUser(ctx);

    const [tx, cats] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, type, category_id")
        .gte("transaction_date", start)
        .lte("transaction_date", end),
      supabase.from("categories").select("id, name"),
    ]);

    if (tx.error) return { content: [{ type: "text", text: tx.error.message }], isError: true };
    const names = new Map((cats.data ?? []).map((c) => [c.id, c.name]));

    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const row of tx.data ?? []) {
      const amount = Number(row.amount) || 0;
      if (row.type === "income") income += amount;
      else if (row.type === "expense") {
        expense += amount;
        const label = (row.category_id && names.get(row.category_id)) || "Uncategorised";
        byCategory[label] = (byCategory[label] ?? 0) + amount;
      }
    }

    const summary = {
      month: target,
      currency: "INR",
      income: Math.round(income),
      expenses: Math.round(expense),
      net: Math.round(income - expense),
      transactionCount: (tx.data ?? []).length,
      byCategory: Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
