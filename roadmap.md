# Loans & EMI navigation
- [x] Connect This Cycle EMI summary to the existing Future loan dashboard.
- [x] Reuse upcoming loan records, due dates, and recorded payment information without adding payments or expenses.
- [x] Verify existing forms, persistence, bill/purchase actions, and available build diagnostics; report limitations.

Verification: This Cycle shortcut selects Future and focuses Loans & EMI; Next Cycle shortcut also selects Future. Existing Add Loan created one temporary loan, Monthly EMI matched its amount after refresh, upcoming EMI matched its saved due day, and existing Delete removed the temporary loan. No active loans remain from testing. Zero-loan summary shows ₹0 after loading. Mobile widths 360/390/412 have no horizontal overflow. Latest harness build diagnostics show build OK. Typecheck and standalone production-build results are not separately available. Bill/purchase mutations, loan payment recording, edit, sign-out/sign-in, and second-account checks were not repeated. Existing payment workflow is non-atomic, so no new quick-pay action was enabled; existing formulas and storage are unchanged.

# Planner reorganization
- [x] Move existing Planner content into four salary-cycle tabs without changing calculations or stored data.
- [x] Verify mobile tabs, default selection, shared metrics, and existing actions.
- [x] Check available build diagnostics and report untested actions and historical-data limitations.

Verification: bill create/paid/undo/delete and purchase create/edit/purchased/undo/delete passed; disposable records removed. Allocation drafts persist between tabs and cancel restores saved values. Goal details, cleared-loan details, and loan form open. No runtime errors. Last Cycle account has no previous-cycle income, so its report share is not tested. Historical allocation snapshots are unavailable. Desktop inherits the existing narrow shared app shell; no shared-shell redesign performed.
# Emergency Fund & Savings consistency
- [x] Four goal types (Emergency/Savings/Investment/Purchase), one Emergency goal per account, existing "Emergency fund" goals retyped.
- [x] Shared essential-expense target (6 × rent+food+travel+EMI+bills) everywhere; merged Emergency Fund Builder into the Emergency goal card.
- [x] Savings advice uses the Allocate amount; SIP card only after 3 months covered; Month-End Forecast moved to This Cycle.

Verification: signed-in preview showed the Emergency card, milestones, score and actions all using ₹29,000 saved / ₹33,943 recommended target / 5.1 months; forecast sits below Salary Left; Add Goal hides Emergency once synced; typecheck and production build passed. SIP gating below 3 months and the second Emergency account were not tested live.

# Emergency Fund verification
- [ ] Verify SIP below/at 3 months using isolated test inputs.
- [ ] Verify Emergency form options and database uniqueness without altering real goals.
- [ ] Verify refresh/sync values and account isolation; fix confirmed goal-cache bugs only.
- [ ] Report actual Planner values, completed checks and remaining limitations.
