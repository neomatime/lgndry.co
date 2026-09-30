# Enquiry Write Flow Implementation Plan

1. Add an additive migration with atomic enquiry-edit and manual-status RPCs, activity logging,
   admin checks, controlled status ownership, and explicit function ACLs.
2. Add shared enquiry edit validation and server actions that authenticate before parsing or data
   access, call the narrow RPCs, and revalidate list/detail/edit/client views.
3. Add the controlled edit form and dynamic edit route with distinct not-found and unavailable
   states.
4. Add the status control to enquiry detail. Hide it after project conversion and link to the
   project that owns subsequent lifecycle changes.
5. Add colocated tests for validation, RPC payloads/results, UI success/failure behavior, route
   guards, migration security, activity, and workflow ownership.
6. Verify the migration in a rolled-back live transaction, run the complete gate, apply the
   migration, run advisors, push `next-migration`, and confirm Vercel deployment success.
