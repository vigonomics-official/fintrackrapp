# Rename FinTrackr to FinSurvive

## Scope
- Replace every user-visible product name with **FinSurvive** across the public site, signed-in app, authentication screens, onboarding, settings, reports, notifications, help/privacy copy, AI Coach copy, loading/error text, and share/export text.
- Update route metadata, Open Graph/Twitter metadata, structured data, documentation served to crawlers, and app identity constants.
- Keep the existing `fintrackrapp.lovable.app` URL and `@fintrackrapp.com` email addresses because they are operational addresses, not display names.
- Preserve lowercase `fintrackr` storage keys, browser events, cache identifiers, and other internal identifiers to avoid breaking saved preferences or app behavior.

## Implementation
- Use the shared app identity constant where it already controls visible About-page branding, and make targeted text replacements elsewhere.
- Update the server-only AI Coach wording only where it names the visible product; keep every security instruction, trust boundary, prompt structure, and action restriction unchanged.
- Do not touch database schema/data, authentication, routes, calculations, navigation, or UI structure.
- Record the branding decision in project guidance so future changes keep the public name and legacy internal identifiers separate.

## Verification
- Search the full project again for all case variants and manually classify every remaining match.
- Confirm each content route still has complete, unique metadata using the new visible brand.
- Run typecheck and production build.
- Inspect the app at representative public, authentication, and signed-in screens to confirm the new name renders without layout regressions.
- Report every changed file and list intentional remaining legacy references, including domains, email addresses, and internal compatibility keys.
