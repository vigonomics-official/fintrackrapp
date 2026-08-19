import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "List transactions",
  description:
    "List the signed-in user's recent FinTrackr transactions, optionally filtered by type and date range.",
  inputSchema: {
    type: z.enum(["income", "expense", "transfer"]).optional().describe("Filter by transaction type."),
    from: z.string().optional().describe("Earliest transaction date, YYYY-MM-DD."),
    to: z.string().optional().describe("Latest transaction date, YYYY-MM-DD."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("transactions")
      .select("id, amount, type, transaction_date, payment_method, notes, subcategory, category_id")
      .order("transaction_date", { ascending: false })
      .limit(limit ?? 20);
    if (type) query = query.eq("type", type);
    if (from) query = query.gte("transaction_date", from);
    if (to) query = query.lte("transaction_date", to);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
