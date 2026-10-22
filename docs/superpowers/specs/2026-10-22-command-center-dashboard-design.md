# Command Center Dashboard Design

## Goal

Replace the `/ops` placeholder with the final operational overview, closely matching
`docs/design-references/command-center.png` while showing only values derived from live OPS records.
The page is a read-only summary; it creates no new database tables, records or write paths.

## Data and failure model

The page authenticates with `requireOpsUser()` before loading Enquiries, Clients, Projects,
Follow-ups, Quotes, Invoices, recent activity and the Email thread count. A server-only aggregate
fetcher returns `null` when any required source fails, allowing the page to render a distinct
temporary-unavailability state. One server-provided instant drives every Johannesburg date and due
state so cards, queue rows and schedules agree.

## Composition

1. Header with the current Johannesburg date and a non-interactive live-overview indicator.
2. Four linked metric cards: New Enquiries, Active Projects, Due Follow-ups and Outstanding
   Invoices.
3. Attention Queue combining overdue/due Follow-ups, unpaid Invoices, sent Quotes, new or incomplete
   Enquiries and Projects with overdue actions or assets ready for delivery. Overdue work sorts first.
4. Engagement Pipeline with linked, factual counts for Client, Enquiry, Attachments, Communication,
   Quote, Booking, Payment, Project, Production, Delivery and Follow-up.
5. Active Record showing the most recently updated live Project and its connected commercial and
   scheduling context.
6. Upcoming Follow-ups, ordered by due date and time.
7. Recent Activity, with record links when the activity collection maps to an OPS route.

## Interaction and responsive behavior

- Every navigation target is a real `Link`.
- The reference's monochrome tokens, thin borders, restrained pills and dense typography are used.
- The attention queue becomes a stacked record layout below the wide desktop breakpoint; no nested
  horizontal scrollbar is introduced.
- Empty sections remain useful and quiet instead of displaying invented sample records.
- The page has no fake trend figures, period filters, bulk actions or controls that do not work.

## Testing

Pure view-model tests cover metrics, attention priority, pipeline counts, active-record selection,
upcoming Follow-ups, activity links and empty data. A page test verifies authentication order and
the unavailable state. The complete five-command repository gate remains the release criterion.
