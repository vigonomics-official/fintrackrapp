# Final Planner → Allocate refinement

## Changes
- Rename the visible “Allocation Health” label to “Plan Health” without changing its score calculation.
- Keep the existing account-backed allocation loading and save safeguards intact.
- Make only any calculation correction confirmed by testing; do not touch other Planner tabs or app areas.

## Verification
- Test manual changes below, at, and above 100%, including ₹0 EMI.
- Verify Auto Allocate totals exactly 100% and leaves ₹0 remaining for a ₹20,800 salary.
- Verify saved allocation survives refresh, leaving and returning, and sign-out/sign-in.
- Check Allocate at 360, 390, 412, and 1280px for overflow and browser errors.
- Run the project typecheck and production build.

## Technical scope
- Expected code scope: the existing Allocate section only.
- No navigation, database, authentication, or unrelated feature changes.
