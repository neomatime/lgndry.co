# LGNDRY.Co Website Migration & OPS Command Center Rebuild

## Recommended Architecture

Do **not** treat this as a simple HTML → TypeScript conversion.

The recommended approach is:

**Preserve the public LGNDRY.Co website → migrate it into a modern Next.js/TypeScript architecture → completely remove the existing OPS implementation → rebuild OPS as a separate authenticated application layer using the PRD and BPMN as the source of truth.**

## Recommended Tech Stack

- **Next.js + React + TypeScript** — App Router, strict TypeScript
- **Tailwind CSS** — design system and responsive styling
- **shadcn/ui + Radix primitives** — accessible interaction primitives, heavily restyled to LGNDRY’s visual system
- **Lucide React** — icons
- **Supabase PostgreSQL** — relational operational data
- **Supabase Auth** — OPS authentication and sessions
- **Supabase Storage** — enquiry files, project assets, invoice attachments
- **Zod** — validation and domain schemas
- **React Hook Form** — forms
- **TanStack Table** — Enquiries, Clients, Follow-ups and Invoice data grids
- **dnd-kit** — Project Kanban drag-and-drop
- **TanStack Query** only where client-side caching is genuinely needed
- **Microsoft Graph + Gmail API behind one provider abstraction** — Inbox/email integration
- **Trigger.dev or Inngest** — scheduled email, mailbox synchronisation, reminders and background processing
- **Sentry** — application monitoring
- **Vitest + React Testing Library + Playwright** — unit/component/E2E tests
- **Vercel + Supabase** — simplest deployment model unless LGNDRY has a specific infrastructure requirement

Avoid adding Redux, a separate Express backend, microservices, GraphQL, or oversized component frameworks unless the existing repository proves a real need.

---

# Claude Code Master Prompt

You are acting as the lead software architect and senior full-stack engineer for the LGNDRY.Co digital platform.

Your assignment is to migrate the existing LGNDRY.Co HTML website to a modern TypeScript application and completely replace the existing OPS Command Center with the newly approved OPS Command Center defined in the supplied Product Requirements Document, BPMN process flow and UI references.

This is not a cosmetic refactor.

You are rebuilding the technical foundation while preserving the existing public LGNDRY.Co experience and introducing a production-grade internal operations application.

## 1. Source of Truth

Before changing any code, locate and review:

1. The existing LGNDRY.Co HTML website and all of its assets.
2. `LGNDRY_OPS_Command_Center_PRD_v1.0`
3. The approved LGNDRY.Co OPS BPMN process flow.
4. All supplied OPS UI reference images.
5. Any existing OPS Command Center implementation currently present in the repository.

Treat the PRD, BPMN and approved screenshots as the authoritative specification for the new OPS system.

Do not invent a competing product architecture.

If an implementation detail is not explicitly defined, infer the smallest solution consistent with:
- the PRD,
- the BPMN process,
- the existing LGNDRY.Co visual identity,
- and the stated principle of keeping the OPS Command Center simple, clean and operationally focused.

Do not begin implementation until you understand the existing repository.

## 2. Primary Objectives

The work has two separate objectives.

### A. Public Website Migration

Migrate the current HTML LGNDRY.Co website into:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS

The migration must preserve:
- current content,
- routes,
- metadata,
- SEO behaviour,
- imagery,
- brand assets,
- responsive behaviour,
- animation behaviour where appropriate,
- links,
- forms,
- public user journeys.

Do not redesign the public website unless necessary to faithfully reproduce its existing behaviour.

Remove unnecessary legacy HTML/CSS/JS only after equivalent functionality has been implemented and verified.

### B. OPS Command Center Rebuild

Completely remove the current OPS Command Center implementation.

Do not reuse the existing OPS UI simply because code already exists.

Build the new OPS Command Center from the supplied PRD, BPMN and approved UI screens.

The new application must be a real operational system, not a static dashboard mockup.

## 3. Recommended Technical Stack

Use the following stack unless the existing repository reveals a strong technical reason not to.

### Frontend / Application
- latest stable Next.js
- React
- TypeScript with strict mode enabled
- App Router
- Tailwind CSS
- shadcn/ui / Radix primitives
- Lucide React icons

### Forms and Validation
- React Hook Form
- Zod

### Operational UI
- TanStack Table
- dnd-kit for Kanban
- TanStack Query only where browser-side async state/caching is genuinely required

### Database
- PostgreSQL
- Supabase

### Authentication
- Supabase Auth

### Storage
- Supabase Storage

### Background Processing
- Trigger.dev or Inngest

### Email Integrations
- Gmail API
- Microsoft Graph
- provider abstraction so OPS does not depend directly on either provider

### Observability
- Sentry
- structured application logging

### Testing
- Vitest
- React Testing Library
- Playwright

### Package Manager
- pnpm

### Deployment Target
- Vercel + Supabase unless the existing infrastructure requires otherwise.

Do **not** introduce:
- Redux unless a proven requirement exists,
- a separate Express backend,
- microservices,
- GraphQL,
- unnecessary abstraction layers,
- excessive third-party UI libraries.

Prefer Next.js server components, server actions and API route handlers where appropriate.

## 4. Target Application Architecture & Mandatory Project Structure

Keep the public LGNDRY.Co website and the OPS application clearly separated inside the same Next.js codebase.

Do **not** fall back to a generic structure such as:

```text
/components
/pages
/utils
```

and do not place most business logic inside route files.

The OPS Command Center is a domain application. Organise it around **business capabilities**, with routes acting primarily as composition/orchestration layers.

Unless the existing repository reveals a genuine technical constraint, migrate toward the following structure.

### 4.1 Recommended Repository Structure

```text
lgndry/
├── .env.example
├── .gitignore
├── .npmrc
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tsconfig.json
├── README.md
│
├── docs/
│   ├── architecture/
│   │   ├── application-architecture.md
│   │   ├── domain-model.md
│   │   ├── email-architecture.md
│   │   ├── permissions-model.md
│   │   └── deployment.md
│   │
│   ├── prd/
│   │   └── LGNDRY_OPS_Command_Center_PRD_v1.0.pdf
│   │
│   ├── bpmn/
│   │   └── lgndry-ops-command-center-process-flow.*
│   │
│   └── design-references/
│       ├── command-center.*
│       ├── enquiries.*
│       ├── view-enquiry.*
│       ├── projects-kanban.*
│       ├── view-project.*
│       ├── clients.*
│       ├── view-client.*
│       ├── inbox.*
│       ├── follow-ups.*
│       ├── view-follow-up.*
│       ├── invoices.*
│       ├── view-invoice.*
│       └── settings.*
│
├── public/
│   ├── brand/
│   │   ├── logo/
│   │   ├── marks/
│   │   └── favicons/
│   ├── images/
│   │   ├── website/
│   │   └── placeholders/
│   ├── fonts/
│   └── icons/
│
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── work/
│   │   │   ├── practice/
│   │   │   ├── fine-art/
│   │   │   ├── about/
│   │   │   ├── start-a-project/
│   │   │   └── [...other-existing-public-routes]/
│   │   │
│   │   ├── ops/
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── page.tsx
│   │   │   │
│   │   │   ├── enquiries/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [enquiryId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [projectId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [clientId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── inbox/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [threadId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── follow-ups/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [followUpId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [invoiceId]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── general/
│   │   │       ├── team/
│   │   │       ├── email/
│   │   │       ├── notifications/
│   │   │       ├── billing/
│   │   │       └── security/
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── callback/
│   │   │   └── logout/
│   │   │
│   │   └── api/
│   │       ├── webhooks/
│   │       │   ├── gmail/
│   │       │   ├── microsoft/
│   │       │   └── payments/
│   │       ├── health/
│   │       └── internal/
│   │
│   ├── features/
│   │   ├── command-center/
│   │   │   ├── components/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── enquiries/
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── projects/
│   │   │   ├── components/
│   │   │   │   ├── kanban/
│   │   │   │   ├── detail/
│   │   │   │   ├── timeline/
│   │   │   │   └── deliverables/
│   │   │   ├── forms/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── clients/
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── inbox/
│   │   │   ├── components/
│   │   │   │   ├── mailbox/
│   │   │   │   ├── thread/
│   │   │   │   ├── composer/
│   │   │   │   ├── attachments/
│   │   │   │   ├── search/
│   │   │   │   └── context-rail/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── providers/
│   │   │   │   ├── gmail/
│   │   │   │   ├── microsoft/
│   │   │   │   └── email-provider.ts
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── follow-ups/
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── invoices/
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   └── settings/
│   │       ├── components/
│   │       ├── forms/
│   │       ├── actions/
│   │       ├── queries/
│   │       ├── services/
│   │       ├── schemas/
│   │       ├── types/
│   │       └── tests/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   │   ├── ops-sidebar.tsx
│   │   │   ├── ops-topbar.tsx
│   │   │   ├── page-header.tsx
│   │   │   └── detail-rail.tsx
│   │   ├── branding/
│   │   ├── feedback/
│   │   │   ├── empty-state.tsx
│   │   │   ├── error-state.tsx
│   │   │   ├── loading-state.tsx
│   │   │   └── permission-state.tsx
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── server.ts
│   │   │   ├── client.ts
│   │   │   └── guards.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── generated.types.ts
│   │   ├── permissions/
│   │   │   ├── roles.ts
│   │   │   ├── permissions.ts
│   │   │   └── authorize.ts
│   │   ├── email/
│   │   │   ├── provider.ts
│   │   │   ├── sync.ts
│   │   │   ├── threading.ts
│   │   │   └── security.ts
│   │   ├── storage/
│   │   ├── validation/
│   │   ├── notifications/
│   │   ├── audit/
│   │   ├── search/
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── server/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── jobs/
│   │   │   ├── mailbox-sync/
│   │   │   ├── scheduled-email/
│   │   │   ├── follow-up-reminders/
│   │   │   └── invoice-reminders/
│   │   └── workflows/
│   │       ├── enquiry-to-project.ts
│   │       ├── project-stage-transition.ts
│   │       ├── invoice-collection.ts
│   │       └── client-follow-up.ts
│   │
│   ├── types/
│   │   ├── domain/
│   │   ├── api/
│   │   └── database/
│   │
│   ├── hooks/
│   ├── styles/
│   │   └── globals.css
│   └── middleware.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── functions/
│       └── [only-if-required]/
│
└── tests/
    ├── e2e/
    │   ├── auth/
    │   ├── enquiries/
    │   ├── projects/
    │   ├── clients/
    │   ├── inbox/
    │   ├── follow-ups/
    │   └── invoices/
    ├── fixtures/
    └── helpers/
```

### 4.2 Route Responsibility

Files under `src/app` should remain thin.

A route should primarily:
1. authenticate the request,
2. enforce access,
3. load or call the relevant feature query/service,
4. compose feature components,
5. expose route-level loading/error boundaries.

Do not place substantial business logic directly inside `page.tsx`, `layout.tsx` or client components.

### 4.3 Feature Responsibility

Each business feature should own its domain behaviour.

Example:

```text
features/projects/
├── components/
│   ├── kanban/
│   ├── detail/
│   ├── timeline/
│   └── deliverables/
├── forms/
├── actions/
├── queries/
├── services/
├── repositories/
├── schemas/
├── types/
└── tests/
```

Use the layers deliberately:

- `components/` — feature-specific presentation and interaction
- `forms/` — form composition and field-level behaviour
- `actions/` — server mutations / application commands
- `queries/` — feature read models
- `services/` — business rules and orchestration
- `repositories/` — persistence access where feature-specific
- `schemas/` — Zod validation and domain input schemas
- `types/` — local TypeScript types
- `tests/` — feature unit/integration tests

Do not create empty folders merely to satisfy this structure. Create a layer when the feature actually needs it.

### 4.4 Shared vs Feature-Specific Components

Use `src/components/ui` only for truly reusable UI primitives such as:

- Button
- Input
- Select
- Dialog
- Drawer
- Table shell
- Badge
- Tabs
- Dropdown menu
- Checkbox
- Tooltip
- Skeleton
- Command/search primitive

Use `src/components/layout` for application shell components.

Do **not** put domain-aware components such as `ProjectCard`, `InvoiceTable`, `EnquiryQualificationChecklist` or `EmailThread` into the generic shared UI folder. They belong to their feature.

### 4.5 Server Boundaries

Keep privileged operations on the server.

Examples:
- database writes,
- invoice state changes,
- OAuth token handling,
- mailbox provider calls requiring secrets,
- permission checks,
- audit writes,
- signed file URL generation,
- workflow transitions.

Do not move server logic to the browser for convenience.

### 4.6 Public Website vs OPS Boundary

The public site and OPS share:
- brand tokens,
- selected UI primitives,
- shared utilities,
- root infrastructure.

They must **not** share operational business components.

Public website code lives primarily under:

```text
src/app/(public)/
```

OPS routes live under:

```text
src/app/ops/
```

OPS domain logic lives under:

```text
src/features/
```

This keeps marketing/presentation code separated from authenticated operational code.

### 4.7 Database Structure

Use version-controlled Supabase migrations.

```text
supabase/
├── migrations/
├── seed.sql
└── functions/
```

Never treat the Supabase dashboard as the source of truth for schema changes.

All schema changes must be reproducible from migrations.

### 4.8 Documentation Structure

Keep implementation documentation inside the repository:

```text
docs/
├── architecture/
├── prd/
├── bpmn/
└── design-references/
```

Claude must use these files as implementation inputs rather than scattering screenshots, specifications and architecture notes throughout the repository.

### 4.9 Project Structure Acceptance Rules

The migration is not structurally complete unless:

- public website routes are under the public route group,
- OPS routes are under `/ops`,
- OPS business domains live under `src/features`,
- generic shared UI is separated from domain components,
- privileged logic is server-side,
- Supabase schema is migration-driven,
- Inbox provider implementations are isolated behind an email-provider interface,
- background jobs are isolated from request/response UI logic,
- BPMN workflow transitions are implemented as explicit workflow/service logic,
- tests are organised by domain,
- obsolete legacy HTML/JS/OPS structures are removed after parity is verified,
- no duplicate “old OPS” and “new OPS” architecture remains at completion.

## 5. OPS Visual System

The approved UI must be followed closely.

Visual direction:

- clean
- editorial
- modern
- quiet
- operational
- generous white space
- predominantly white
- black typography
- stone-grey surfaces
- very restrained colour
- thin grey borders
- minimal shadows
- simple geometry
- compact monochrome iconography
- no excessive rounded SaaS cards
- no gradients
- no decorative dashboard noise

The user must be able to understand what requires attention immediately.

The interface should feel like an internal operating system for a premium creative business.

Maintain the approved desktop shell:

### Left Sidebar
- LGNDRY.Co identity
- Command Center
- Enquiries
- Projects
- Clients
- Inbox
- Follow-ups
- Invoices
- Settings

### Top Bar
- universal search
- date/today control where relevant
- logged-in user
- account menu

The visual references are not loose inspiration. Treat them as the approved design direction.

## 6. Core Domain Model

Model the platform around connected operational records.

```text
Client
  ↓
Enquiry
  ↓
Quote / Proposal
  ↓
Booking / Approval
  ↓
Project
  ↓
Production / Delivery
  ↓
Invoice
  ↓
Payment
  ↓
Follow-up / Relationship
```

Communication must connect across the entire lifecycle.

Suggested primary entities:

- User
- Role
- Permission
- Client
- ClientContact
- ClientNote
- Enquiry
- EnquiryAttachment
- EnquiryService
- EnquiryStatusHistory
- Project
- ProjectMember
- ProjectMilestone
- ProjectTask
- ProjectDeliverable
- ProjectFile
- ProjectStatusHistory
- FollowUp
- FollowUpTask
- FollowUpHistory
- Invoice
- InvoiceLineItem
- Payment
- InvoiceAttachment
- EmailAccount
- EmailThread
- EmailMessage
- EmailParticipant
- EmailAttachment
- EmailLabel
- CommunicationLink
- Activity
- AuditLog
- Notification
- SystemSetting
- WorkspaceSetting

Relationships must allow one communication/email thread to be linked to:
- Client
- Enquiry
- Project
- Invoice
- Follow-up

Do not duplicate relationship data unnecessarily.

## 7. BPMN Operating Flow

Implement the OPS lifecycle around the approved BPMN process.

The main flow is:

### Enquiry
- capture client demand
- create enquiry
- review enquiry
- validate attachments
- qualify enquiry

### Qualification Decision

If not qualified:
- close/archive enquiry with reason

If qualified:
- create proposal/quote
- send to client

### Proposal
- client reviews
- revisions may occur
- client approves

### Booking
- confirm scope
- obtain required approval/deposit
- convert approved enquiry into project
- assign project team
- schedule kickoff

### Project Delivery
- planning
- pre-production
- production
- review
- delivery

Client feedback/revision loops must be supported.

When delivery is accepted:
- mark project delivered

### Invoicing
- generate invoice
- send invoice
- track payment

If unpaid:
- reminder
- follow-up
- continue collection workflow

If paid:
- mark invoice paid

### Follow-up
- client check-in
- satisfaction / feedback
- testimonial or referral where appropriate
- new opportunity if identified

This lifecycle should drive statuses, available actions and linked records throughout OPS.

## 8. Command Center

Route:

```text
/ops
```

Build the approved attention-led Command Center.

It must show:

### Summary Metrics
- New Enquiries
- Active Projects
- Due Follow-ups
- Outstanding Invoices

### Attention Queue
- client
- item type
- current stage
- next action
- due date
- status

### Additional Sections
- Engagement Pipeline
- Active Record
- Upcoming Follow-ups
- Recent Activity

The Command Center is not an analytics dashboard.

It answers:
- What needs attention?
- Who owns it?
- What happens next?
- What is late?
- What is waiting for the client?
- What is waiting for LGNDRY?
- What financial action is outstanding?

## 9. Enquiries

Routes:

```text
/ops/enquiries
/ops/enquiries/[enquiryId]
```

### List Screen

Implement:
- New Enquiries
- Awaiting Review
- Qualified
- Missing Attachments

Table filters:
- All
- New
- Reviewed
- Qualified
- Archived

Columns:
- Enquiry ID
- Client / Contact
- Service Type
- Submitted
- Attachments
- Status
- Next Action
- Assignee

### Detail Screen

Implement:
- enquiry overview
- service type
- budget
- timeline
- owner
- attachments
- communication
- follow-ups
- qualification checklist
- enquiry details
- contact details
- routing and ownership
- opportunity snapshot
- recent activity

Primary action:

**QUALIFY ENQUIRY**

### CRUD

**Create**
- manual enquiry
- inbound website enquiry
- email-linked enquiry

**Read**
- list
- detail
- related activity

**Update**
- enquiry details
- owner
- service type
- budget
- timeline
- qualification status
- attachments
- notes

**Delete**
Never casually hard-delete business records.

Use archive/close semantics unless the record is an invalid accidental creation and the user has sufficient permission.

## 10. Projects

Routes:

```text
/ops/projects
/ops/projects/[projectId]
```

Projects must use the approved Kanban interface.

Columns:
- Planning
- Pre-Production
- Production
- Review
- Delivery

Cards must show:
- project ID
- client
- project name
- service
- current milestone
- date
- payment status
- owner
- deliverable completion
- file/comment counts where useful

Implement drag-and-drop using dnd-kit.

Do not blindly allow drag-and-drop to bypass business rules.

Validate status transitions.

Clicking a project opens the contextual panel or full project page.

### Project Detail Screen

Implement tabs:
- Overview
- Timeline
- Deliverables
- Files
- Communication
- Finance
- Activity

Include:
- current stage
- payment status
- timeline
- owner
- budget
- deliverables progress
- project overview
- scope/services
- project timeline
- production checklist
- communication snapshot
- team and contacts
- next actions
- deliverables
- budget & billing
- recent activity

### CRUD

- Create project
- Read project
- Update project
- Archive project

Support enquiry → project conversion.

## 11. Clients

Routes:

```text
/ops/clients
/ops/clients/[clientId]
```

### List View

Metrics:
- Active Clients
- Key Accounts
- Projects in Progress
- Outstanding Balances

Table:
- Client ID
- Client / Primary Contact
- Category
- Active Projects
- Last Activity
- Account Status
- Outstanding
- Owner

### Detail View

- account status
- active projects
- lifetime value
- outstanding balance
- client since
- owner
- account overview
- preferred services
- active projects
- communication snapshot
- relationship notes
- primary contact
- financial snapshot
- invoices
- recent activity

### CRUD
- Create
- Read
- Update
- Archive

Client deletion should normally mean archive, not hard-delete.

## 12. Follow-ups

Routes:

```text
/ops/follow-ups
/ops/follow-ups/[followUpId]
```

### List Metrics
- Due Today
- Overdue
- Due This Week
- Completed This Week

Filters:
- All
- Due Today
- Overdue
- Upcoming
- Completed

### Detail Screen

- type
- status
- priority
- due
- owner
- related item
- overview
- checklist
- communication snapshot
- notes
- client/contact
- linked records
- schedule & ownership
- history
- activity

### CRUD
- Create
- Read
- Update
- Complete
- Cancel/archive

Follow-ups may be linked to:
- Client
- Enquiry
- Project
- Invoice
- Email Thread

## 13. Invoices

Routes:

```text
/ops/invoices
/ops/invoices/[invoiceId]
```

### List View

Metrics:
- Outstanding Balance
- Invoices Sent
- Paid This Month
- Due This Week

Statuses:
- Draft
- Sent
- Open
- Paid
- Overdue
- Void where appropriate

### Detail View

- status
- payment state
- amount
- due date
- owner
- billing type
- invoice overview
- billing contact
- notes
- line items
- payment history
- linked records
- attachments
- collection follow-up
- outstanding snapshot
- recent activity

Actions:
- create invoice
- edit draft
- send
- resend
- download
- record payment
- create follow-up
- void

Never hard-delete issued financial records.

## 14. Inbox — Full Email Portal

Route:

```text
/ops/inbox
```

This is a major functional module.

Do not implement a simplistic message viewer.

Build a full operational email portal with functionality comparable to a modern Gmail-style mailbox.

### Mailboxes
- Inbox
- All Mail
- Sent
- Drafts
- Starred
- Snoozed
- Scheduled
- Spam
- Trash
- Archive
- custom labels/folders
- unread counts

### Message Actions
- compose
- reply
- reply all
- forward
- save draft
- auto-save draft
- delete
- restore
- archive
- mark read
- mark unread
- star
- unstar
- snooze
- unsnooze
- move
- apply/remove labels
- mark spam
- report phishing where provider permits
- print
- download original message where available
- open message in thread
- conversation threading

### Composer
- To
- CC
- BCC
- From / sending identity
- Subject
- rich-text body
- plain-text fallback
- attachments
- inline images
- links
- signatures
- templates
- draft autosave
- schedule send
- send immediately
- discard
- reply context
- forwarded content
- spellcheck/browser spellcheck
- keyboard shortcuts where appropriate

### Attachments
- upload
- download
- preview
- remove before send
- attach multiple files
- preserve received attachments
- associate attachments with OPS records
- respect provider attachment limits
- safe file validation

### Threads
- threaded conversations
- participant history
- collapsed/expanded messages
- unread state
- timestamps
- attachments per message
- message actions
- thread actions

### Search

Support advanced mailbox search.

Where possible support operators conceptually equivalent to:
- `from:`
- `to:`
- `cc:`
- `subject:`
- `has:attachment`
- `is:unread`
- `is:read`
- `is:starred`
- `label:`
- `after:`
- `before:`
- `larger:`
- `smaller:`
- `filename:`

Do not unnecessarily recreate the provider's search engine if provider-side search APIs can safely support the requirement.

### Filters / Rules

Users must be able to define rules based on:
- sender
- recipient
- subject
- body keywords
- attachments
- labels
- mailbox

Actions may include:
- apply label
- mark read
- star
- archive
- assign OPS owner
- link to client where matching is reliable
- create operational notification

### Labels
- create
- rename
- remove
- colour metadata if supported by provider
- apply to thread
- remove from thread

### Scheduled Send
- schedule message
- view scheduled messages
- modify before send
- cancel scheduled send

### Undo Send

Implement an appropriate delayed-send mechanism where supported.

### Signatures
- personal signatures
- default signature
- alternate signature per sending identity

### Templates
- save reusable email templates
- insert
- rename
- update
- delete

### Contact Support
- autocomplete known client contacts
- autocomplete team members
- recent recipients

### Out-of-Office
- vacation responder where supported by connected provider

### Forwarding
- user-configurable forwarding where integration permissions permit

### Aliases / Send-As
- support alternate sending identities where provider permits

### Delegated / Shared Mailboxes
- support shared operational inboxes where configured
- display which account/mailbox a message belongs to

### Multiple Accounts
Design the data model so multiple connected inboxes can be supported even if the first release only connects one mailbox.

### Offline / Resiliency
If true offline email is not practical in this architecture, implement resilient caching and clearly document the limitation rather than pretending full provider-level offline capability exists.

### Email Settings
- signature
- sender identity
- inbox sync
- notifications
- default reply behaviour
- threading preferences where applicable
- forwarding where permitted
- vacation responder
- connected accounts

### Integration

Implement provider adapters such as:

```ts
interface EmailProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refreshAuth(): Promise<void>;
  listThreads(): Promise<unknown>;
  getThread(): Promise<unknown>;
  listMessages(): Promise<unknown>;
  sendMessage(): Promise<unknown>;
  saveDraft(): Promise<unknown>;
  updateDraft(): Promise<unknown>;
  deleteDraft(): Promise<void>;
  archive(): Promise<void>;
  trash(): Promise<void>;
  restore(): Promise<void>;
  markRead(): Promise<void>;
  markUnread(): Promise<void>;
  star(): Promise<void>;
  unstar(): Promise<void>;
  applyLabel(): Promise<void>;
  removeLabel(): Promise<void>;
  search(): Promise<unknown>;
  scheduleSend?(): Promise<unknown>;
  sync(): Promise<void>;
}
```

Create implementations such as:
- `GmailProvider`
- `MicrosoftGraphProvider`

Do not spread provider-specific APIs throughout components.

## 15. OPS-Aware Email

Inbox is more than email.

Every relevant conversation should be capable of linking to:
- Client
- Enquiry
- Project
- Invoice
- Follow-up

The right-side contextual panel should show relevant operational context.

Examples:

Email arrives from a known client:
- identify contact
- surface client record

Email references existing project:
- allow project association

Client requests work:
- create enquiry from email

Client requests action:
- create follow-up from email

Email contains approved project information:
- attach to project communication history

Invoice query:
- associate with invoice

Do not automatically create business records unless confidence is sufficiently high or the user confirms the action.

## 16. Settings

Route:

```text
/ops/settings
```

Tabs:
- General
- Team
- Notifications
- Billing
- Security

### General
- workspace profile
- branding
- region
- timezone
- currency
- contact information
- operational preferences

### Team
- users
- roles
- permissions

### Notifications
- enquiry
- missing attachment
- due follow-up
- overdue invoice
- received payment
- relevant email events

### Billing Defaults
- payment terms
- currency
- invoice defaults

### Security
- MFA
- session timeout
- audit access
- login/session history where appropriate

## 17. CRUD Principles

All major modules must implement deliberate CRUD behaviour.

### Create
Validate before persistence.

### Read
Respect authorization and tenant/workspace boundaries.

### Update
Capture relevant audit history.

### Delete
Prefer business-safe lifecycle actions:
- Archive
- Close
- Cancel
- Void
- Trash

Do not expose destructive hard delete for core records unless necessary.

Where hard delete is supported:
- require permission
- require explicit confirmation
- audit the event

## 18. Permissions

Implement RBAC.

Initial roles can include:

### Admin
Full access.

### Operations Lead
Enquiries, Clients, Projects, Follow-ups, Inbox.

### Producer
Assigned projects and relevant communications.

### Finance
Invoices, payments and financial data.

### Standard User
Limited operational access.

Do not rely only on hidden UI controls.

Permissions must be enforced server-side.

## 19. Audit Trail

Important operational changes must create immutable audit events.

Examples:
- enquiry created
- enquiry qualified
- enquiry archived
- owner changed
- project created
- project stage changed
- project delivered
- invoice created
- invoice sent
- invoice paid
- invoice voided
- follow-up completed
- client changed
- email linked to a record
- attachment added/deleted
- permission changed

Store:
- actor
- action
- entity
- entity ID
- timestamp
- relevant before/after metadata where reasonable

## 20. Universal Search

The top search field should search across:
- clients
- contacts
- enquiries
- projects
- invoices
- follow-ups
- emails

Results should clearly identify record type.

Do not build a heavyweight search service initially unless PostgreSQL search proves insufficient.

## 21. Files & Attachments

Store private operational files securely.

Requirements:
- authorized access only
- signed URLs where appropriate
- file metadata
- uploader
- linked entity
- created timestamp
- MIME validation
- size validation
- virus/malware scanning strategy documented
- avoid public bucket exposure

## 22. Responsive Behaviour

Primary design target:
desktop operations environment.

Still support:
- large laptop
- standard laptop
- tablet
- constrained mobile use

Desktop layouts should not simply shrink onto mobile.

On smaller screens:
- sidebar may collapse
- tables may become alternative structured list views
- Kanban may horizontally scroll
- detail panels may become drawers or routes

## 23. Accessibility

Use semantic HTML.

Ensure:
- keyboard navigation
- focus visibility
- labelled form fields
- screen-reader accessible controls
- adequate contrast
- keyboard usable Kanban alternatives
- dialog focus trapping
- accessible validation states

## 24. Database and Security

Create migrations.

Do not manually mutate production schema.

Use foreign keys.

Use indexes on:
- statuses
- owners
- due dates
- client IDs
- project IDs
- email thread IDs
- timestamps
- commonly searched fields

Use Supabase RLS where relevant.

Never expose service-role secrets to the browser.

Validate server-side.

Sanitise dangerous input.

Protect private files.

Use secure OAuth flows.

Store provider tokens securely.

Never log OAuth access or refresh tokens.

## 25. Data Seeding

Create development seed data matching the approved references where practical.

Examples may include:
- Blackridge Hotels
- Lumen Partners
- Seacliff Originals
- Treadwell Resorts
- Drift Studio
- Northshore Media

Do not hard-code these into production UI.

They are development fixtures only.

## 26. Migration Strategy

Do this incrementally.

### Phase 1 — Audit

Inspect:
- repository
- HTML
- CSS
- JS
- assets
- routes
- dependencies
- current OPS implementation
- existing backend/database if any

Return an architecture assessment before destructive changes.

### Phase 2 — Foundation

Create:
- Next.js application structure
- TypeScript
- Tailwind
- linting
- formatting
- environment validation
- testing
- Supabase integration
- authentication

### Phase 3 — Public Website Migration

Migrate existing public website into React/TypeScript.

Validate route/content parity.

### Phase 4 — Remove Legacy OPS

Once the new OPS shell is ready, remove old OPS components/routes/styles that are no longer used.

Do not leave dead duplicated systems.

### Phase 5 — Data Foundation

Implement domain entities, database migrations, repositories/services and permissions.

### Phase 6 — OPS Modules

Build in this order:

1. OPS shell
2. Clients
3. Enquiries
4. Projects
5. Follow-ups
6. Invoices
7. Inbox
8. Settings
9. Command Center

This order allows later modules to depend on mature domain records.

### Phase 7 — BPMN Automation

Implement workflow transitions and linked record behaviour.

### Phase 8 — Testing

- Unit
- Integration
- E2E
- Accessibility
- Responsive
- Security checks

### Phase 9 — Remove Dead Code

Delete obsolete:
- HTML copies
- legacy OPS
- styles
- JS
- unused dependencies
- dead routes

### Phase 10 — Final Documentation

Update README with:
- project architecture
- local setup
- environment variables
- Supabase setup
- migrations
- email integration
- testing
- deployment
- operational workflow

## 27. Acceptance Criteria

Do not consider the migration complete merely because the application compiles.

### Public Website
- content preserved
- routes preserved
- visuals materially consistent
- responsive
- SEO metadata preserved
- no broken assets
- no broken navigation

### OPS
- user can authenticate
- client CRUD works
- enquiry CRUD works
- enquiries can be qualified
- enquiry can become project
- Kanban stage transitions persist
- project detail works
- follow-up CRUD works
- invoice CRUD/lifecycle works
- payments can be recorded
- linked records work
- activity feeds work
- audit events exist
- permissions work
- private attachments work
- inbox connects to provider
- threads load
- email can be composed/sent
- replies work
- forwarding works
- drafts work
- attachments work
- labels work
- archive/trash/spam/read/star functionality works
- advanced search works
- scheduled sending works where supported
- OPS record linking from email works
- Command Center reflects real operational data
- universal search works
- responsive behaviour is deliberately implemented
- critical flows have E2E tests

## 28. Implementation Discipline

Do not generate the entire application blindly in one pass.

First:

1. inspect the repository,
2. identify technical debt,
3. identify migration risk,
4. map existing routes,
5. identify assets,
6. identify existing backend dependencies,
7. compare the current OPS implementation against the PRD,
8. propose the final architecture,
9. propose the database entities,
10. propose the migration sequence.

Then implement.

After every major module:

- typecheck
- lint
- run relevant tests
- inspect responsive behaviour
- remove regressions before continuing

Do not use `any` to silence TypeScript errors.

Do not suppress errors without understanding them.

Do not replace working code unnecessarily.

Do not leave mock functionality behind a production-looking UI.

Do not introduce placeholder buttons that do nothing.

Where a feature is deliberately deferred, make that explicit in code/docs rather than pretending it is implemented.

## 29. Required First Response

Before editing code, respond with:

1. Current repository assessment
2. Existing public website architecture
3. Existing OPS architecture
4. Key migration risks
5. Proposed final architecture
6. Proposed directory structure
7. Proposed database/domain model
8. Email integration strategy
9. Authentication and permissions strategy
10. Migration plan by phase
11. Anything in the existing codebase that conflicts with the PRD/BPMN

Only after that assessment should implementation begin.

---

## Locked Architectural Direction

Do **not** structure the codebase as:

```text
/components
/pages
/utils
```

and dump everything into those three directories.

OPS is a real domain application. Structure it around **business capabilities**:

```text
features/
├── enquiries/
├── projects/
├── clients/
├── inbox/
├── follow-ups/
├── invoices/
└── settings/
```

Routes should orchestrate these features rather than own all application logic.

The Inbox should **not** become an email server.

Gmail and Microsoft 365 already provide the mail infrastructure. OPS should operate as an **operational client over those providers**, synchronising relevant messages and linking them to LGNDRY's Clients, Enquiries, Projects, Follow-ups and Invoices.
