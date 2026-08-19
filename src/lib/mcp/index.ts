import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import addTransaction from "./tools/add-transaction";
import listCategories from "./tools/list-categories";
import spendingSummary from "./tools/spending-summary";
import listBudgets from "./tools/list-budgets";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "fintrackr-dashboard-final-options",
  title: "FinTrackr Dashboard final options",
  version: "0.1.0",
  instructions:
    "Tools for FinTrackr, a personal finance tracker for India (INR). Use list_categories to resolve category ids, list_transactions and spending_summary to read the user's money data, list_budgets for monthly limits, and add_transaction to record new income or expenses.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTransactions, addTransaction, listCategories, spendingSummary, listBudgets],
});
