import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_transaction",
  title: "Add transaction",
  description: "Record a new income, expense or transfer in FinTrackr for the signed-in user.",
  inputSchema: {
    amount: z.number().positive().describe("Amount in INR."),
    type: z.enum(["income", "expense", "transfer"]).describe("Transaction type."),
    transaction_date: z.string().optional().describe("Date of the transaction, YYYY-MM-DD. Defaults to today."),
    category_id: z.string().uuid().optional().describe("Category id from list_categories."),
    payment_method: z
      .enum(["cash", "upi", "bank", "credit_card", "debit_card", "wallet"])
      .optional()
      .describe("How it was paid."),
    notes: z.string().max(300).optional().describe("Short note for the transaction."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: ctx.getUserId()!,
        amount: input.amount,
        type: input.type,
        transaction_date: input.transaction_date ?? new Date().toISOString().slice(0, 10),
        ...(input.category_id ? { category_id: input.category_id } : {}),
        ...(input.payment_method ? { payment_method: input.payment_method } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { transaction: data },
    };
  },
});
