# Enquiry Write Flow Design

## Goal

Make the existing Enquiries statuses operational. An authenticated OPS admin can amend an
enquiry, move an unconverted enquiry through the pre-project lifecycle, and see every mutation in
Activity. Project-owned statuses remain controlled by the Projects module.

## Workflow Ownership

- Admin-managed statuses: New, Reviewing, Quoted, Follow-up, Closed.
- Creating a project from an enquiry is the only path to Booked.
- A linked project synchronizes In Production and Completed.
- Once a project is linked, the enquiry status control becomes read-only and links to that project.
- Contact and brief fields remain editable after conversion because they describe the source
  enquiry; editing them does not rewrite the linked Client or Project.

## Product Surface

- Add **Edit Enquiry** to `/ops/enquiries/[id]`.
- Add an explicit status control to unconverted enquiry details.
- Add `/ops/enquiries/[id]/edit` with contact and project-brief fields.
- Reuse the existing Create Project/Open Project actions.
- Record changed field names and status transitions in the existing Activity tab.

## Data And Security

- Keep the existing enquiries schema and RLS policy.
- Add two atomic, admin-gated RPCs: `update_enquiry_record` and `set_enquiry_status`.
- Revoke function execution from PUBLIC, anon, authenticated, and service_role, then grant only
  authenticated. Each function independently checks `is_admin(auth.uid())`.
- Validate the same field bounds and project types used by the public Start a Project form.
- Preserve `client_id`, source, creation time, attachments, and linked-project records.

## Verification

- Unit coverage for schemas, actions, edit form, status control, route states, and SQL contracts.
- Full repository formatting, typecheck, lint, test, and production build gate.
- Compile and exercise the migration against the live schema inside a rolled-back transaction
  before applying it.
