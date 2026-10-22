# Premium OPS Experience Foundation

## Goal

Establish the approved Command Center screenshot as the shared application language without
replacing working business workflows or introducing decorative controls. This is the first complete
slice of the wider LGNDRY.Co application transformation.

## Audit findings

- The App Router, Tailwind v4, Lucide and existing monochrome tokens are the correct foundation.
- Module data and write workflows are already separated into server fetchers, pure view-models and
  client components; that structure must remain intact.
- The dashboard body is live and truthful, but the shell is static: no persistent collapse state,
  no global record search, no route transition treatment and no structural loading state.
- The dashboard greeting is generic and the Attention Queue lacks the approved working filters.
- There is no notification store, saved-view model, report model or reliable historical trend data.
  Those controls must not be simulated.

## Scope

1. Add neutral radius, shadow and motion tokens while preserving the existing colour tokens.
2. Add a persistent, keyboard-accessible collapsible OPS sidebar.
3. Add a stable top bar with authenticated global record search and `Ctrl/Cmd + K` access.
4. Search real Clients, Enquiries, Projects, Invoices and Follow-ups and link to their records.
5. Add a timezone-correct personalised dashboard greeting.
6. Add functional search, client, type and stage filters to the Attention Queue.
7. Add restrained route, button and card interactions with reduced-motion support.
8. Add a structural OPS loading state and shared premium panel primitive.

## Boundaries

- No database migration or new dependency.
- No fabricated notification badge, theme switch, trends, priorities, documents or search results.
- No external email or automated action.
- Notifications, saved views, reports, team workload, communication timelines and the full
  module-by-module visual migration remain later vertical slices.

## Acceptance

- Sidebar preference survives a reload and labels remain accessible while collapsed.
- Search is admin-gated, fails closed, uses real records and offers only routes that exist.
- Dashboard greeting uses the authenticated profile and Africa/Johannesburg time.
- Queue filters alter visible records and produce an explicit filtered-empty state.
- The shell is stable across navigation, honours reduced motion and introduces no horizontal page
  overflow.
- Formatting, TypeScript, lint, tests and production build pass.
