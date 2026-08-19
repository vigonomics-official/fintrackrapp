import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_budgets",
  title: "List budgets",
  description: "List the signed-in user's monthly category budgets in FinTrackr.",
  inputSchema: {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Month in YYYY-MM format. Defaults to all months."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("budgets").select("id, month, monthly_limit, category_id").order("month", {
      ascending: false,
    });
    if (month) query = query.eq("month", `${month}-01`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { budgets: data ?? [] },
    };
  },
});
