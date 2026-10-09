# Planner reorganization
- [x] Move existing Planner content into four salary-cycle tabs without changing calculations or stored data.
- [x] Verify mobile tabs, default selection, shared metrics, and existing actions.
- [x] Check available build diagnostics and report untested actions and historical-data limitations.

Verification: bill create/paid/undo/delete and purchase create/edit/purchased/undo/delete passed; disposable records removed. Allocation drafts persist between tabs and cancel restores saved values. Goal details, cleared-loan details, and loan form open. No runtime errors. Last Cycle account has no previous-cycle income, so its report share is not tested. Historical allocation snapshots are unavailable. Desktop inherits the existing narrow shared app shell; no shared-shell redesign performed.