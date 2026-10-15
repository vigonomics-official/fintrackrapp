# Project rules

- Present the product name as “FinSurvive”; preserve legacy `fintrackr` domains, email addresses, storage keys, cache keys, and event identifiers for compatibility.
- Render product marks through the shared AppBrand/AppMark components so public, authentication, loading, and signed-in surfaces stay visually consistent.
- Planner keeps visited salary-cycle panels mounted and hides inactive panels so switching tabs preserves form drafts and pending allocation saves.
- Planner loan shortcuts select the mounted Future panel and focus its existing loan section; EMI summaries reuse the shared survival metric rather than add financial entries.
- Loan payments and reversals go only through the record_loan_payment / reverse_loan_payment database functions (src/lib/loan-payments.ts) so history and balance change atomically and retries are deduplicated.
