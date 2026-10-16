# Project rules

- Present the product name as “FinSurvive”; preserve legacy `fintrackr` domains, email addresses, storage keys, cache keys, and event identifiers for compatibility.
- Render product marks through the shared AppBrand/AppMark components so public, authentication, loading, and signed-in surfaces stay visually consistent.
- Planner keeps visited salary-cycle panels mounted and hides inactive panels so switching tabs preserves form drafts and pending allocation saves.
- Planner loan shortcuts select the mounted Future panel and focus its existing loan section; EMI summaries reuse the shared survival metric rather than add financial entries.
- Loan payments and reversals go only through the record_loan_payment / reverse_loan_payment database functions (src/lib/loan-payments.ts) so history and balance change atomically and retries are deduplicated.
- Goals have exactly four kinds (emergency/savings/investment/purchase); at most one emergency goal per user, enforced by the goals_one_emergency_per_user partial unique index and hidden in goal forms once one exists.
- Emergency Fund numbers come only from the shared metrics in src/lib/financial-metrics.ts: saved = the one emergency goal, target = 6 × monthlyEssentialExpenses (rent/food/travel transactions + loan EMIs + recurring bills, no double counting); monthly savings advice is the Planner Allocate savings amount, never a hardcoded rule.
