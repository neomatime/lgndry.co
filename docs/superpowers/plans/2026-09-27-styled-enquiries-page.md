# Styled Enquiries Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `/ops/enquiries` verification page with a real, styled Enquiries list page and a new `/ops/enquiries/[id]` detail page, using only data that's real today.

**Architecture:** Two Server Component pages (list, detail), each backed by a small server-only fetch function (try/catch/log/return-a-result-type, matching `src/features/shop/catalogue/data.ts`'s established convention) and a pure, framework-agnostic view-model module (row/stat shaping, filtering, sorting — unit-testable with no mocking). Three small, reusable presentational primitives (`StatusBadge`, `StatCard`, `Tabs`) live in shared component folders so later OPS modules (Projects, Clients, Follow-ups, Invoices) can reuse them. One existing bug is fixed along the way: `submitProjectEnquiry`'s `ops_activity_log` insert never captured the enquiry id, so it couldn't be filtered per-enquiry for the new Activity tab.

**Tech Stack:** Next.js 16 App Router (Server Components + one Client Component per page for interactivity), TypeScript, Tailwind, Vitest + Testing Library, Supabase (`@supabase/ssr`), `lucide-react` icons, `tailwind-merge`/`clsx` via the existing `cn` helper.

**Spec:** `docs/superpowers/specs/2026-09-27-styled-enquiries-page-design.md`

## Global Constraints

- Use the live `enquiries.status` values exactly: `New, Reviewing, Quoted, Follow-up, Booked, In Production, Completed, Closed`. Never the reference images' wording (Awaiting Review / Qualified / Missing Files / etc.).
- Render `project_type` as a single pill. Never invent multi-tag "Services Requested" data — the schema only has one value per enquiry.
- No Assignee/Owner UI anywhere (no team-assignment concept exists — one admin user in the whole project today).
- No trend deltas on stat cards (no status-history table exists) — plain counts/values only.
- No new Tailwind color tokens. The existing palette (`src/styles/globals.css`) is `ink`, `ink-muted`, `surface`, `surface-soft`, `line`, `line-strong` — monochrome by design. `StatusBadge` reuses these only.
- No new npm dependencies (relative-time formatting uses `Intl.RelativeTimeFormat`, already built into the JS runtime — no date library).
- Data-fetch functions never throw on a Supabase/Storage error: they `try/catch`, `console.error`, and return a result the page can render a distinct "temporarily unavailable" state from — matching `src/features/shop/catalogue/data.ts`'s `fetchCollection` exactly. The `/ops/error.tsx` boundary (which renders `ErrorState`) stays reserved for genuinely unexpected/uncaught exceptions; no page renders `ErrorState` itself.
- No pagination, no server-side search/filter/sort round-trips — one server fetch per page load, all interaction client-side. Justified by current near-zero volume; revisit only if real volume growth demands it.
- No Edit Enquiry / Qualify Enquiry / Export / New Enquiry write-flow UI — this plan makes the *read* side real; write flows are separate, later scope.
- Full gate suite (`pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`) must pass before any task is considered done.

## Review Focus

1. **An enquiry with `company: null`.** The reference images always show a company name; a real submission can omit it (the field is optional in the public form). The list table's "Client/Contact" cell and the detail page's header/right rail must degrade gracefully (show just the contact name, no dangling "null" or empty line).
2. **An enquiry with zero attachments.** Must count correctly as "Missing Attachments" on the list's stat card, show "0" (not blank) in the table's Attachments column, and the detail page's Attachments tab must show a real empty state, not an empty table shell.
3. **A `status` value that has no special-cased styling branch.** All 8 real values must render a badge — a status the implementer didn't explicitly test for must never fall through to blank/undefined styling.
4. **The list page with zero enquiries at all** (a fresh environment, or between the last delivered enquiry and the next). Every stat card must show 0, not `NaN`/`undefined`, and the page must show the friendly empty-state copy, not a blank table.
5. **A Supabase/Storage call failing on either page.** Both fetch functions must be independently exercised failing (not just their happy path) to confirm the page renders the distinct "temporarily unavailable" state, not a silent empty list/table indistinguishable from "genuinely no data."

---

### Task 1: Shared status type, `StatusBadge`, and `StatCard`

**Files:**
- Create: `src/features/enquiries/types.ts`
- Create: `src/components/ops/status-badge.tsx`
- Test: `src/components/ops/status-badge.test.tsx`
- Create: `src/components/ops/stat-card.tsx`
- Test: `src/components/ops/stat-card.test.tsx`

**Interfaces:**
- Produces: `ENQUIRY_STATUSES: readonly string[]`, `type EnquiryStatus`,
  `StatusBadge({ status: EnquiryStatus })`, `StatCard({ icon: LucideIcon,
  label: string, value: React.ReactNode })`. Every later task imports
  `EnquiryStatus` from `@/features/enquiries/types`, and both components
  from their paths above.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/ops/status-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ops/status-badge";

describe("StatusBadge", () => {
  it("renders the status text for every real status value", () => {
    const statuses = [
      "New",
      "Reviewing",
      "Quoted",
      "Follow-up",
      "Booked",
      "In Production",
      "Completed",
      "Closed",
    ] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    }
  });

  it("gives New the filled treatment", () => {
    render(<StatusBadge status="New" />);
    expect(screen.getByText("New").className).toContain("bg-ink");
  });

  it("gives an in-progress status the neutral filled treatment", () => {
    render(<StatusBadge status="Reviewing" />);
    expect(screen.getByText("Reviewing").className).toContain("bg-line");
  });

  it("gives a terminal status the quieter outline treatment", () => {
    render(<StatusBadge status="Closed" />);
    expect(screen.getByText("Closed").className).toContain("text-ink-muted");
  });
});
```

```typescript
// src/components/ops/stat-card.test.tsx
import { render, screen } from "@testing-library/react";
import { Mail } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/components/ops/stat-card";

describe("StatCard", () => {
  it("renders the label and a numeric value", () => {
    render(<StatCard icon={Mail} label="New Enquiries" value={8} />);
    expect(screen.getByText("New Enquiries")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders any node as the value, not just a number", () => {
    render(<StatCard icon={Mail} label="Status" value={<span>Awaiting Review</span>} />);
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/ops/status-badge.test.tsx src/components/ops/stat-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ops/status-badge'` (and `stat-card`)

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/enquiries/types.ts
export const ENQUIRY_STATUSES = [
  "New",
  "Reviewing",
  "Quoted",
  "Follow-up",
  "Booked",
  "In Production",
  "Completed",
  "Closed",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
```

```tsx
// src/components/ops/status-badge.tsx
import { cn } from "@/lib/utils/cn";
import type { EnquiryStatus } from "@/features/enquiries/types";

const TERMINAL: ReadonlySet<EnquiryStatus> = new Set(["Completed", "Closed"]);

/**
 * The design system is intentionally monochrome (ink/ink-muted/surface/line)
 * -- no colored tokens exist anywhere in this codebase, so status is
 * distinguished by weight, not hue: New (unactioned) gets the same filled
 * treatment as a primary Button; every in-progress status gets a neutral
 * filled pill; the two terminal statuses get a quieter outline.
 */
export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const classes =
    status === "New"
      ? "bg-ink text-white"
      : TERMINAL.has(status)
        ? "border-line-strong text-ink-muted border"
        : "bg-line text-ink";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        classes,
      )}
    >
      {status}
    </span>
  );
}
```

```tsx
// src/components/ops/stat-card.tsx
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border-line flex items-center gap-4 border p-5">
      <span className="bg-surface-soft flex size-11 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-ink-muted text-sm">{label}</p>
        <div className="text-2xl font-medium">{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/ops/status-badge.test.tsx src/components/ops/stat-card.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/enquiries/types.ts src/components/ops/status-badge.tsx src/components/ops/status-badge.test.tsx src/components/ops/stat-card.tsx src/components/ops/stat-card.test.tsx
git commit -m "feat: shared EnquiryStatus type, StatusBadge and StatCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Fix the activity-log linkage bug in `submitProjectEnquiry`

**Files:**
- Modify: `src/features/start-a-project/actions.ts`
- Modify (existing test file): `src/features/start-a-project/actions.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `submitProjectEnquiry`'s `ops_activity_log` insert now includes
  `collection: "enquiries"` and `record_id` (the uuid `submit_enquiry()`
  returns). Task 6 (detail data fetch) reads `ops_activity_log` filtered by
  exactly these two columns.

- [ ] **Step 1: Write the failing test**

The existing test file's `beforeEach` already mocks
`rpc.mockResolvedValue({ data: "new-id", error: null })` — the mock already
returns an id, the code just doesn't use it yet. Change the existing
assertion in the first test (do not add a new `it` block — this tightens an
existing one):

```typescript
// src/features/start-a-project/actions.test.ts
// Replace the existing assertion inside
// it("uploads each attachment, then calls submit_enquiry, then logs activity", ...)
// from:
//   expect(insert).toHaveBeenCalledWith(
//     "ops_activity_log",
//     expect.objectContaining({ message: expect.stringContaining("Thandi Mokoena") }),
//   );
// to:
    expect(insert).toHaveBeenCalledWith(
      "ops_activity_log",
      expect.objectContaining({
        message: expect.stringContaining("Thandi Mokoena"),
        collection: "enquiries",
        record_id: "new-id",
      }),
    );
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/features/start-a-project/actions.test.ts`
Expected: FAIL — the `insert` mock's actual call doesn't yet include `collection`/`record_id`.

- [ ] **Step 3: Fix the implementation**

In `src/features/start-a-project/actions.ts`, change:

```typescript
  const { error: rpcError } = await supabase.rpc(
    "submit_enquiry",
    submitEnquiryArgs(input.data, uploaded),
  );
  if (rpcError) {
    console.error("start-a-project: submit_enquiry failed:", rpcError.message);
    return FAILED;
  }

  // Best-effort: the enquiry itself is already saved even if this fails.
  const { error: activityError } = await supabase
    .from("ops_activity_log")
    .insert({ message: enquiryActivityMessage(input.data.full_name) });
```

to:

```typescript
  const { data: newEnquiryId, error: rpcError } = await supabase.rpc(
    "submit_enquiry",
    submitEnquiryArgs(input.data, uploaded),
  );
  if (rpcError) {
    console.error("start-a-project: submit_enquiry failed:", rpcError.message);
    return FAILED;
  }

  // Best-effort: the enquiry itself is already saved even if this fails.
  // collection/record_id link this row to the enquiry so its Activity tab
  // can filter to just its own entries.
  const { error: activityError } = await supabase.from("ops_activity_log").insert({
    message: enquiryActivityMessage(input.data.full_name),
    collection: "enquiries",
    record_id: newEnquiryId,
  });
```

- [ ] **Step 4: Run the full test file to verify it passes**

Run: `pnpm exec vitest run src/features/start-a-project/actions.test.ts`
Expected: PASS, all tests green (the other 9 tests are unaffected — none of
them assert on the activity-log insert's exact shape).

- [ ] **Step 5: Commit**

```bash
git add src/features/start-a-project/actions.ts src/features/start-a-project/actions.test.ts
git commit -m "fix: link the ops_activity_log row to its enquiry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: List page view-model (pure) and data fetch

**Files:**
- Create: `src/features/enquiries/list-view-model.ts`
- Test: `src/features/enquiries/list-view-model.test.ts`
- Create: `src/features/enquiries/fetch-enquiries.ts`
- Test: `src/features/enquiries/fetch-enquiries.test.ts`

**Interfaces:**
- Consumes: `EnquiryStatus`/`ENQUIRY_STATUSES` from
  `@/features/enquiries/types` (Task 1).
- Produces: `EnquiryListItem` type, `buildEnquiryListItems(enquiries,
  attachmentCounts): EnquiryListItem[]`, `computeEnquiryStats(rows):
  { New: number; Reviewing: number; Quoted: number; missingAttachments:
  number }`, `countByStatus(rows): Record<EnquiryStatus, number>`,
  `filterEnquiries(rows, { status, search }): EnquiryListItem[]`,
  `sortEnquiries(rows, direction): EnquiryListItem[]`, and
  `fetchEnquiries(): Promise<EnquiryListItem[] | null>`. Task 4 (list page
  UI) imports all of these.

The old bare verification page (`src/app/(app)/ops/enquiries/page.tsx`)
still imports `src/features/start-a-project/admin/build-enquiry-rows.ts` at
this point in the plan — do not delete that file or its test in this task.
Task 4 replaces the page (removing that import) and deletes both retired
files in the same commit, so the branch is never left with a dangling
import. This task only adds the two new modules below.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/enquiries/list-view-model.test.ts
import { describe, expect, it } from "vitest";
import {
  buildEnquiryListItems,
  computeEnquiryStats,
  countByStatus,
  filterEnquiries,
  sortEnquiries,
  type EnquiryListItem,
  type EnquiryRecord,
} from "@/features/enquiries/list-view-model";

const enquiryRecord = (over: Partial<EnquiryRecord> = {}): EnquiryRecord => ({
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  status: "New",
  created_at: "2026-09-27T10:00:00Z",
  ...over,
});

describe("buildEnquiryListItems", () => {
  it("shapes an enquiry record with its attachment count", () => {
    const items = buildEnquiryListItems(
      [enquiryRecord()],
      new Map([["e1", 2]]),
    );
    expect(items).toEqual([
      {
        id: "e1",
        fullName: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        phone: "0761234567",
        projectType: "Documentary",
        location: "Polokwane",
        timeline: "Next 1-3 months",
        description: "A short documentary series.",
        budget: "R20,000 - R35,000",
        status: "New",
        createdAt: "2026-09-27T10:00:00Z",
        attachmentCount: 2,
      },
    ]);
  });

  it("gives an enquiry with no matching entry a zero attachment count", () => {
    const items = buildEnquiryListItems([enquiryRecord()], new Map());
    expect(items[0]!.attachmentCount).toBe(0);
  });

  it("handles a null company without throwing", () => {
    const items = buildEnquiryListItems([enquiryRecord({ company: null })], new Map());
    expect(items[0]!.company).toBeNull();
  });
});

function item(over: Partial<EnquiryListItem> = {}): EnquiryListItem {
  return {
    id: "e1",
    fullName: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    projectType: "Documentary",
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    status: "New",
    createdAt: "2026-09-27T10:00:00Z",
    attachmentCount: 1,
    ...over,
  };
}

describe("computeEnquiryStats", () => {
  it("counts New, Reviewing, Quoted and missing-attachments correctly", () => {
    const rows = [
      item({ id: "1", status: "New" }),
      item({ id: "2", status: "New" }),
      item({ id: "3", status: "Reviewing" }),
      item({ id: "4", status: "Quoted", attachmentCount: 0 }),
      item({ id: "5", status: "Closed", attachmentCount: 0 }),
    ];
    expect(computeEnquiryStats(rows)).toEqual({
      New: 2,
      Reviewing: 1,
      Quoted: 1,
      missingAttachments: 2,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(computeEnquiryStats([])).toEqual({
      New: 0,
      Reviewing: 0,
      Quoted: 0,
      missingAttachments: 0,
    });
  });
});

describe("countByStatus", () => {
  it("counts every one of the 8 real statuses, including ones with zero rows", () => {
    const rows = [item({ id: "1", status: "New" }), item({ id: "2", status: "New" })];
    expect(countByStatus(rows)).toEqual({
      New: 2,
      Reviewing: 0,
      Quoted: 0,
      "Follow-up": 0,
      Booked: 0,
      "In Production": 0,
      Completed: 0,
      Closed: 0,
    });
  });
});

describe("filterEnquiries", () => {
  const rows = [
    item({ id: "1", fullName: "Thandi Mokoena", company: "Blackridge Hotels", status: "New" }),
    item({ id: "2", fullName: "James Mitchell", company: null, status: "Quoted", projectType: "Film" }),
  ];

  it("returns everything for status All and an empty search", () => {
    expect(filterEnquiries(rows, { status: "All", search: "" })).toHaveLength(2);
  });

  it("filters by exact status", () => {
    const result = filterEnquiries(rows, { status: "Quoted", search: "" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("searches case-insensitively across name, company, email and project type", () => {
    expect(filterEnquiries(rows, { status: "All", search: "blackridge" })).toHaveLength(1);
    expect(filterEnquiries(rows, { status: "All", search: "FILM" })).toHaveLength(1);
  });

  it("doesn't throw when a row's company is null", () => {
    expect(() => filterEnquiries(rows, { status: "All", search: "mitchell" })).not.toThrow();
    expect(filterEnquiries(rows, { status: "All", search: "mitchell" })).toHaveLength(1);
  });
});

describe("sortEnquiries", () => {
  const rows = [
    item({ id: "old", createdAt: "2026-09-01T00:00:00Z" }),
    item({ id: "new", createdAt: "2026-09-27T00:00:00Z" }),
  ];

  it("sorts newest first", () => {
    expect(sortEnquiries(rows, "newest").map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("sorts oldest first", () => {
    expect(sortEnquiries(rows, "oldest").map((r) => r.id)).toEqual(["old", "new"]);
  });
});
```

```typescript
// src/features/enquiries/fetch-enquiries.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const enquiriesResult = { data: [] as unknown[], error: null as { message: string } | null };
const attachmentsResult = { data: [] as unknown[], error: null as { message: string } | null };

const fakeClient = {
  from: (table: string) => {
    if (table === "enquiries") {
      return {
        select: () => ({
          order: () => Promise.resolve(enquiriesResult),
        }),
      };
    }
    return { select: () => Promise.resolve(attachmentsResult) };
  },
};

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => fakeClient,
}));

beforeEach(() => {
  enquiriesResult.data = [];
  enquiriesResult.error = null;
  attachmentsResult.data = [];
  attachmentsResult.error = null;
});

describe("fetchEnquiries", () => {
  it("shapes rows with their attachment counts on success", async () => {
    enquiriesResult.data = [
      {
        id: "e1",
        full_name: "Thandi Mokoena",
        company: "Blackridge Hotels",
        email: "thandi@example.com",
        phone: "0761234567",
        project_type: "Documentary",
        location: "Polokwane",
        timeline: "Next 1-3 months",
        description: "A short documentary series.",
        budget: "R20,000 - R35,000",
        status: "New",
        created_at: "2026-09-27T10:00:00Z",
      },
    ];
    attachmentsResult.data = [{ enquiry_id: "e1" }, { enquiry_id: "e1" }];

    const { fetchEnquiries } = await import("@/features/enquiries/fetch-enquiries");
    const result = await fetchEnquiries();

    expect(result).not.toBeNull();
    expect(result![0]!.attachmentCount).toBe(2);
  });

  it("returns null when the enquiries query fails", async () => {
    enquiriesResult.error = { message: "connection refused" };

    const { fetchEnquiries } = await import("@/features/enquiries/fetch-enquiries");
    expect(await fetchEnquiries()).toBeNull();
  });

  it("returns null when the attachments query fails", async () => {
    attachmentsResult.error = { message: "connection refused" };

    const { fetchEnquiries } = await import("@/features/enquiries/fetch-enquiries");
    expect(await fetchEnquiries()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/enquiries/list-view-model.test.ts src/features/enquiries/fetch-enquiries.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/enquiries/list-view-model.ts
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/features/enquiries/types";

export type EnquiryListItem = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  phone: string;
  projectType: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  createdAt: string;
  attachmentCount: number;
};

export type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string;
  project_type: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  created_at: string;
};

/** Pure view-model builder, kept separate from data fetching so it's testable without mocking. */
export function buildEnquiryListItems(
  enquiries: EnquiryRecord[],
  attachmentCounts: Map<string, number>,
): EnquiryListItem[] {
  return enquiries.map((enquiry) => ({
    id: enquiry.id,
    fullName: enquiry.full_name,
    company: enquiry.company,
    email: enquiry.email,
    phone: enquiry.phone,
    projectType: enquiry.project_type,
    location: enquiry.location,
    timeline: enquiry.timeline,
    description: enquiry.description,
    budget: enquiry.budget,
    status: enquiry.status,
    createdAt: enquiry.created_at,
    attachmentCount: attachmentCounts.get(enquiry.id) ?? 0,
  }));
}

export function computeEnquiryStats(rows: EnquiryListItem[]) {
  return {
    New: rows.filter((row) => row.status === "New").length,
    Reviewing: rows.filter((row) => row.status === "Reviewing").length,
    Quoted: rows.filter((row) => row.status === "Quoted").length,
    missingAttachments: rows.filter((row) => row.attachmentCount === 0).length,
  };
}

export function countByStatus(rows: EnquiryListItem[]): Record<EnquiryStatus, number> {
  const counts = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0])) as Record<
    EnquiryStatus,
    number
  >;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export function filterEnquiries(
  rows: EnquiryListItem[],
  { status, search }: { status: EnquiryStatus | "All"; search: string },
): EnquiryListItem[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "All" && row.status !== status) return false;
    if (!query) return true;
    return (
      row.fullName.toLowerCase().includes(query) ||
      (row.company ?? "").toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.projectType.toLowerCase().includes(query)
    );
  });
}

export function sortEnquiries(
  rows: EnquiryListItem[],
  direction: "newest" | "oldest",
): EnquiryListItem[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return direction === "newest" ? sorted.reverse() : sorted;
}
```

```typescript
// src/features/enquiries/fetch-enquiries.ts
import "server-only";
import { createSupabaseServerClient } from "@/lib/db/server";
import { buildEnquiryListItems, type EnquiryListItem } from "@/features/enquiries/list-view-model";

/**
 * Every enquiry with its attachment count, newest first, or `null` when it
 * can't be loaded (so the page can show a distinct "temporarily unavailable"
 * state instead of an error) -- matches the established convention in
 * src/features/shop/catalogue/data.ts's fetchCollection.
 */
export async function fetchEnquiries(): Promise<EnquiryListItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: enquiries, error: enquiriesError }, { data: attachments, error: attachmentsError }] =
      await Promise.all([
        supabase
          .from("enquiries")
          .select(
            "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("enquiry_attachments").select("enquiry_id"),
      ]);
    if (enquiriesError) throw enquiriesError;
    if (attachmentsError) throw attachmentsError;

    const attachmentCounts = new Map<string, number>();
    for (const attachment of (attachments ?? []) as { enquiry_id: string }[]) {
      attachmentCounts.set(attachment.enquiry_id, (attachmentCounts.get(attachment.enquiry_id) ?? 0) + 1);
    }

    return buildEnquiryListItems(enquiries ?? [], attachmentCounts);
  } catch (error) {
    console.error("Could not load enquiries", error);
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/enquiries/list-view-model.test.ts src/features/enquiries/fetch-enquiries.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/enquiries/list-view-model.ts src/features/enquiries/list-view-model.test.ts src/features/enquiries/fetch-enquiries.ts src/features/enquiries/fetch-enquiries.test.ts
git commit -m "feat: Enquiries list view-model and data fetch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: List page UI

**Files:**
- Create: `src/features/enquiries/components/enquiries-table.tsx`
- Test: `src/features/enquiries/components/enquiries-table.test.tsx`
- Modify: `src/app/(app)/ops/enquiries/page.tsx` (full rewrite)
- Modify: `src/components/layout/ops-nav.tsx:29` (flip `available` to `true`)
- Delete: `src/features/start-a-project/admin/build-enquiry-rows.ts`
- Delete: `src/features/start-a-project/admin/build-enquiry-rows.test.ts`

**Interfaces:**
- Consumes: `StatusBadge`/`StatCard` (Task 1), everything from
  `list-view-model.ts`/`fetch-enquiries.ts` (Task 3),
  `PageHeader`/`EmptyState` (existing), `requireOpsUser` (existing).
- Produces: the page itself, at `/ops/enquiries`. No later task consumes
  this directly.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/enquiries/components/enquiries-table.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { EnquiriesTable } from "@/features/enquiries/components/enquiries-table";
import type { EnquiryListItem } from "@/features/enquiries/list-view-model";

function row(over: Partial<EnquiryListItem> = {}): EnquiryListItem {
  return {
    id: "e1",
    fullName: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    projectType: "Documentary",
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    status: "New",
    createdAt: "2026-09-27T10:00:00Z",
    attachmentCount: 1,
    ...over,
  };
}

describe("EnquiriesTable", () => {
  it("renders every row", () => {
    render(
      <EnquiriesTable
        rows={[row({ id: "1", fullName: "Thandi Mokoena" }), row({ id: "2", fullName: "James Mitchell" })]}
      />,
    );
    expect(screen.getByText("Thandi Mokoena")).toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("narrows the list when searching", () => {
    render(
      <EnquiriesTable
        rows={[row({ id: "1", fullName: "Thandi Mokoena" }), row({ id: "2", fullName: "James Mitchell" })]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search enquiries..."), {
      target: { value: "James" },
    });
    expect(screen.queryByText("Thandi Mokoena")).not.toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("filters by status tab", () => {
    render(
      <EnquiriesTable
        rows={[
          row({ id: "1", fullName: "Thandi Mokoena", status: "New" }),
          row({ id: "2", fullName: "James Mitchell", status: "Quoted" }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Quoted/ }));
    expect(screen.queryByText("Thandi Mokoena")).not.toBeInTheDocument();
    expect(screen.getByText("James Mitchell")).toBeInTheDocument();
  });

  it("shows an inline preview when a row's checkbox is checked", () => {
    render(<EnquiriesTable rows={[row({ description: "A short documentary series." })]} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("A short documentary series.")).toBeInTheDocument();
  });

  it("navigates to the detail page when a row is clicked", () => {
    render(<EnquiriesTable rows={[row({ id: "e1" })]} />);
    fireEvent.click(screen.getByText("Thandi Mokoena"));
    expect(push).toHaveBeenCalledWith("/ops/enquiries/e1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/enquiries/components/enquiries-table.test.tsx`
Expected: FAIL — `Cannot find module '@/features/enquiries/components/enquiries-table'`

- [ ] **Step 3: Write the component**

```tsx
// src/features/enquiries/components/enquiries-table.tsx
"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ops/status-badge";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/features/enquiries/types";
import {
  countByStatus,
  filterEnquiries,
  sortEnquiries,
  type EnquiryListItem,
} from "@/features/enquiries/list-view-model";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" });

export function EnquiriesTable({ rows }: { rows: EnquiryListItem[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<EnquiryStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [checkedId, setCheckedId] = useState<string | null>(null);

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const visible = useMemo(
    () => sortEnquiries(filterEnquiries(rows, { status, search }), sort),
    [rows, status, search, sort],
  );
  const checked = visible.find((row) => row.id === checkedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line flex items-center justify-between border-b">
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={status === "All"}
            onClick={() => setStatus("All")}
            className={
              status === "All"
                ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
            }
          >
            All ({rows.length})
          </button>
          {ENQUIRY_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={
                status === value
                  ? "border-ink text-ink shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                  : "text-ink-muted hover:text-ink shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap"
              }
            >
              {value} ({counts[value]})
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="search"
            placeholder="Search enquiries..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-line-strong h-9 border px-3 text-sm"
          />
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
            className="border-line-strong h-9 border px-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-ink-muted py-14 text-center text-sm">No enquiries match this filter.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-line border-b text-left">
              <th className="w-8 py-2" />
              <th className="py-2 pr-4">Client / Contact</th>
              <th className="py-2 pr-4">Project Type</th>
              <th className="py-2 pr-4">Submitted</th>
              <th className="py-2 pr-4">Attachments</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-line hover:bg-surface-soft border-b align-top">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={checkedId === row.id}
                    onChange={(event) => setCheckedId(event.target.checked ? row.id : null)}
                    aria-label={`Preview ${row.fullName}`}
                  />
                </td>
                <td className="cursor-pointer py-2 pr-4" onClick={() => router.push(`/ops/enquiries/${row.id}`)}>
                  <p className="font-medium">{row.fullName}</p>
                  {row.company ? <p className="text-ink-muted">{row.company}</p> : null}
                </td>
                <td className="py-2 pr-4">{row.projectType}</td>
                <td className="py-2 pr-4">{dateFormatter.format(new Date(row.createdAt))}</td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {row.attachmentCount}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {checked ? (
        <div className="border-line grid gap-6 border p-6 md:grid-cols-3">
          <div>
            <h3 className="font-medium">Enquiry Details</h3>
            <dl className="text-ink-muted mt-2 space-y-1 text-sm">
              <div>
                <dt className="inline">Client: </dt>
                <dd className="text-ink inline">{checked.company ?? checked.fullName}</dd>
              </div>
              <div>
                <dt className="inline">Contact: </dt>
                <dd className="text-ink inline">{checked.fullName}</dd>
              </div>
              <div>
                <dt className="inline">Status: </dt>
                <dd className="inline">
                  <StatusBadge status={checked.status} />
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="font-medium">Project Brief</h3>
            <p className="text-ink-muted mt-2 text-sm">{checked.description}</p>
          </div>
          <div>
            <h3 className="font-medium">Attachments ({checked.attachmentCount})</h3>
            <p className="text-ink-muted mt-2 text-sm">
              {checked.attachmentCount === 0
                ? "No attachments."
                : "Open the full record to view attachments."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/enquiries/components/enquiries-table.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Rewrite the page**

```tsx
// src/app/(app)/ops/enquiries/page.tsx
import type { Metadata } from "next";
import { FileText, Mail, Eye, Paperclip } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { EnquiriesTable } from "@/features/enquiries/components/enquiries-table";
import { computeEnquiryStats } from "@/features/enquiries/list-view-model";
import { fetchEnquiries } from "@/features/enquiries/fetch-enquiries";
import { requireOpsUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  await requireOpsUser();
  const rows = await fetchEnquiries();

  if (rows === null) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Enquiries" description="Track incoming project requests." />
        <EmptyState title="Enquiries are temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const stats = computeEnquiryStats(rows);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Enquiries" description="Track incoming project requests and attachments." />
      {rows.length === 0 ? (
        <EmptyState title="No enquiries yet">
          Submissions from /start-a-project will appear here.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Mail} label="New Enquiries" value={stats.New} />
            <StatCard icon={Eye} label="Reviewing" value={stats.Reviewing} />
            <StatCard icon={FileText} label="Quoted" value={stats.Quoted} />
            <StatCard icon={Paperclip} label="Missing Attachments" value={stats.missingAttachments} />
          </div>
          <EnquiriesTable rows={rows} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Flip the nav item to available**

In `src/components/layout/ops-nav.tsx`, change:

```typescript
  { label: "Enquiries", href: "/ops/enquiries", icon: Mail, available: false },
```

to:

```typescript
  { label: "Enquiries", href: "/ops/enquiries", icon: Mail, available: true },
```

- [ ] **Step 7: Delete the retired files**

The page rewrite in Step 5 removed the last import of
`build-enquiry-rows.ts` (Task 3 deliberately left it in place, since deleting
it before this step would have left the branch with a dangling import). Safe
to delete now:

```bash
git rm src/features/start-a-project/admin/build-enquiry-rows.ts src/features/start-a-project/admin/build-enquiry-rows.test.ts
```

- [ ] **Step 8: Manual smoke check**

With the dev server running (`preview_start` in this environment, or
`pnpm dev` elsewhere), sign in as the admin and open `/ops/enquiries`.
Confirm: the "Enquiries" sidebar link is now clickable (no longer "Soon"),
the stat cards show real counts, the status tabs filter correctly, search
narrows the table, checking a row's checkbox shows the inline preview, and
clicking a row navigates to `/ops/enquiries/<that row's id>` (a 404 is
expected here until Task 6 ships the detail page — that's fine, confirms the
navigation itself works).

- [ ] **Step 9: Run the full gate suite**

Run: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all five pass. `pnpm typecheck` and `pnpm build` specifically
confirm no other file still imports the two files deleted in Step 7.

- [ ] **Step 10: Commit**

```bash
git add src/features/enquiries/components/enquiries-table.tsx src/features/enquiries/components/enquiries-table.test.tsx "src/app/(app)/ops/enquiries/page.tsx" src/components/layout/ops-nav.tsx
git commit -m "feat: styled Enquiries list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `Tabs` component and relative-time helper

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Test: `src/components/ui/tabs.test.tsx`
- Create: `src/features/enquiries/relative-time.ts`
- Test: `src/features/enquiries/relative-time.test.ts`

**Interfaces:**
- Produces: `type TabItem = { id: string; label: string; content:
  React.ReactNode }`, `Tabs({ items: TabItem[]; defaultTabId?: string })`,
  `relativeTime(isoDate: string, now?: Date): string`. Task 6 (detail data
  fetch) uses `relativeTime`; Task 7 (detail page UI) uses `Tabs`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ui/tabs.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "@/components/ui/tabs";

describe("Tabs", () => {
  it("renders the first tab's content by default", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    expect(screen.getByText("Overview content")).toBeInTheDocument();
    expect(screen.queryByText("Attachments content")).not.toBeInTheDocument();
  });

  it("switches content when a tab is clicked", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Attachments" }));
    expect(screen.getByText("Attachments content")).toBeInTheDocument();
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
  });

  it("respects an explicit defaultTabId", () => {
    render(
      <Tabs
        defaultTabId="b"
        items={[
          { id: "a", label: "Overview", content: <p>Overview content</p> },
          { id: "b", label: "Attachments", content: <p>Attachments content</p> },
        ]}
      />,
    );
    expect(screen.getByText("Attachments content")).toBeInTheDocument();
  });
});
```

```typescript
// src/features/enquiries/relative-time.test.ts
import { describe, expect, it } from "vitest";
import { relativeTime } from "@/features/enquiries/relative-time";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("relativeTime", () => {
  it("says 'just now' for anything under a minute", () => {
    expect(relativeTime("2026-09-27T11:59:30Z", NOW)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(relativeTime("2026-09-27T11:55:00Z", NOW)).toBe("5 minutes ago");
  });

  it("formats hours", () => {
    expect(relativeTime("2026-09-27T10:00:00Z", NOW)).toBe("2 hours ago");
  });

  it("formats days", () => {
    expect(relativeTime("2026-09-24T12:00:00Z", NOW)).toBe("3 days ago");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/components/ui/tabs.test.tsx src/features/enquiries/relative-time.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/tabs.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export type TabItem = { id: string; label: string; content: React.ReactNode };

export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div>
      <div role="tablist" className="border-line flex gap-1 overflow-x-auto border-b">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active?.id}
            onClick={() => setActiveId(item.id)}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              item.id === active?.id
                ? "border-ink text-ink"
                : "text-ink-muted hover:text-ink border-transparent",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-6">
        {active?.content}
      </div>
    </div>
  );
}
```

```typescript
// src/features/enquiries/relative-time.ts
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 hours ago", or "just now" for anything under a minute. No new dependency -- Intl.RelativeTimeFormat is built into the JS runtime. */
export function relativeTime(isoDate: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  for (const [unit, secondsInUnit] of UNITS) {
    if (seconds >= secondsInUnit) {
      return formatter.format(-Math.floor(seconds / secondsInUnit), unit);
    }
  }
  return "just now";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/ui/tabs.test.tsx src/features/enquiries/relative-time.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/tabs.tsx src/components/ui/tabs.test.tsx src/features/enquiries/relative-time.ts src/features/enquiries/relative-time.test.ts
git commit -m "feat: Tabs component and relativeTime helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Detail page view-model (pure) and data fetch

**Files:**
- Create: `src/features/enquiries/detail-view-model.ts`
- Test: `src/features/enquiries/detail-view-model.test.ts`
- Create: `src/features/enquiries/fetch-enquiry-detail.ts`
- Test: `src/features/enquiries/fetch-enquiry-detail.test.ts`

**Interfaces:**
- Consumes: `EnquiryStatus` (Task 1), `relativeTime` (Task 5).
- Produces: `EnquiryDetail` type, `buildEnquiryDetail(enquiry, attachments,
  signedUrlByPath, activity, now?): EnquiryDetail`, `type
  EnquiryDetailResult = { status: "ok"; enquiry: EnquiryDetail } | { status:
  "not-found" } | { status: "error" }`, `fetchEnquiryDetail(id):
  Promise<EnquiryDetailResult>`. Task 7 (detail page UI) imports both.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/enquiries/detail-view-model.test.ts
import { describe, expect, it } from "vitest";
import { buildEnquiryDetail } from "@/features/enquiries/detail-view-model";

const enquiry = {
  id: "e1",
  full_name: "Thandi Mokoena",
  company: "Blackridge Hotels",
  email: "thandi@example.com",
  phone: "0761234567",
  project_type: "Documentary",
  location: "Polokwane",
  timeline: "Next 1-3 months",
  description: "A short documentary series.",
  budget: "R20,000 - R35,000",
  status: "New" as const,
  source: "Website",
  created_at: "2026-09-27T10:00:00Z",
};

const NOW = new Date("2026-09-27T12:00:00Z");

describe("buildEnquiryDetail", () => {
  it("shapes the enquiry, its attachments and its activity", () => {
    const detail = buildEnquiryDetail(
      enquiry,
      [{ file_name: "brief.pdf", storage_path: "e1/0-brief.pdf", size_bytes: 2_400_000 }],
      new Map([["e1/0-brief.pdf", "https://signed.example/brief.pdf"]]),
      [{ id: "a1", message: "New project enquiry from Thandi Mokoena", created_at: "2026-09-27T10:00:00Z" }],
      NOW,
    );

    expect(detail.id).toBe("e1");
    expect(detail.attachments).toEqual([
      { fileName: "brief.pdf", sizeBytes: 2_400_000, url: "https://signed.example/brief.pdf" },
    ]);
    expect(detail.activity).toEqual([
      { id: "a1", message: "New project enquiry from Thandi Mokoena", relativeTime: "2 hours ago" },
    ]);
  });

  it("gives an attachment with no signed url a null url", () => {
    const detail = buildEnquiryDetail(
      enquiry,
      [{ file_name: "brief.pdf", storage_path: "e1/0-brief.pdf", size_bytes: 1024 }],
      new Map(),
      [],
      NOW,
    );
    expect(detail.attachments[0]!.url).toBeNull();
  });

  it("handles a null company and null budget without throwing", () => {
    const detail = buildEnquiryDetail(
      { ...enquiry, company: null, budget: null },
      [],
      new Map(),
      [],
      NOW,
    );
    expect(detail.company).toBeNull();
    expect(detail.budget).toBeNull();
  });
});
```

```typescript
// src/features/enquiries/fetch-enquiry-detail.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const enquiryResult = { data: null as unknown, error: null as { message: string } | null };
const attachmentsResult = { data: [] as unknown[], error: null as { message: string } | null };
const activityResult = { data: [] as unknown[], error: null as { message: string } | null };
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/x" } }));

const fakeClient = {
  from: (table: string) => {
    if (table === "enquiries") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(enquiryResult),
          }),
        }),
      };
    }
    if (table === "enquiry_attachments") {
      return { select: () => ({ eq: () => Promise.resolve(attachmentsResult) }) };
    }
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ order: () => Promise.resolve(activityResult) }) }),
      }),
    };
  },
  storage: { from: () => ({ createSignedUrl }) },
};

vi.mock("@/lib/db/server", () => ({
  createSupabaseServerClient: async () => fakeClient,
}));

beforeEach(() => {
  enquiryResult.data = null;
  enquiryResult.error = null;
  attachmentsResult.data = [];
  attachmentsResult.error = null;
  activityResult.data = [];
  activityResult.error = null;
  createSignedUrl.mockClear();
});

describe("fetchEnquiryDetail", () => {
  it("returns ok with the shaped enquiry on success", async () => {
    enquiryResult.data = {
      id: "e1",
      full_name: "Thandi Mokoena",
      company: "Blackridge Hotels",
      email: "thandi@example.com",
      phone: "0761234567",
      project_type: "Documentary",
      location: "Polokwane",
      timeline: "Next 1-3 months",
      description: "A short documentary series.",
      budget: "R20,000 - R35,000",
      status: "New",
      source: "Website",
      created_at: "2026-09-27T10:00:00Z",
    };

    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    const result = await fetchEnquiryDetail("e1");

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.enquiry.id).toBe("e1");
  });

  it("returns not-found when no matching row exists", async () => {
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("missing")).toEqual({ status: "not-found" });
  });

  it("returns error when the enquiry query fails", async () => {
    enquiryResult.error = { message: "connection refused" };
    const { fetchEnquiryDetail } = await import("@/features/enquiries/fetch-enquiry-detail");
    expect(await fetchEnquiryDetail("e1")).toEqual({ status: "error" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/features/enquiries/detail-view-model.test.ts src/features/enquiries/fetch-enquiry-detail.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/enquiries/detail-view-model.ts
import { relativeTime } from "@/features/enquiries/relative-time";
import type { EnquiryStatus } from "@/features/enquiries/types";

export type EnquiryDetail = {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  phone: string;
  projectType: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  source: string;
  createdAt: string;
  attachments: { fileName: string; sizeBytes: number; url: string | null }[];
  activity: { id: string; message: string; relativeTime: string }[];
};

type EnquiryRecord = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string;
  project_type: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: EnquiryStatus;
  source: string;
  created_at: string;
};

type AttachmentRecord = { file_name: string; storage_path: string; size_bytes: number };
type ActivityRecord = { id: string; message: string; created_at: string };

/** Pure view-model builder, kept separate from data fetching so it's testable without mocking. */
export function buildEnquiryDetail(
  enquiry: EnquiryRecord,
  attachments: AttachmentRecord[],
  signedUrlByPath: Map<string, string | null>,
  activity: ActivityRecord[],
  now: Date = new Date(),
): EnquiryDetail {
  return {
    id: enquiry.id,
    fullName: enquiry.full_name,
    company: enquiry.company,
    email: enquiry.email,
    phone: enquiry.phone,
    projectType: enquiry.project_type,
    location: enquiry.location,
    timeline: enquiry.timeline,
    description: enquiry.description,
    budget: enquiry.budget,
    status: enquiry.status,
    source: enquiry.source,
    createdAt: enquiry.created_at,
    attachments: attachments.map((attachment) => ({
      fileName: attachment.file_name,
      sizeBytes: attachment.size_bytes,
      url: signedUrlByPath.get(attachment.storage_path) ?? null,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      message: entry.message,
      relativeTime: relativeTime(entry.created_at, now),
    })),
  };
}
```

```typescript
// src/features/enquiries/fetch-enquiry-detail.ts
import "server-only";
import { buildEnquiryDetail, type EnquiryDetail } from "@/features/enquiries/detail-view-model";
import { createSupabaseServerClient } from "@/lib/db/server";

const BUCKET = "enquiry-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

export type EnquiryDetailResult =
  | { status: "ok"; enquiry: EnquiryDetail }
  | { status: "not-found" }
  | { status: "error" };

export async function fetchEnquiryDetail(id: string): Promise<EnquiryDetailResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: enquiry, error: enquiryError } = await supabase
      .from("enquiries")
      .select(
        "id, full_name, company, email, phone, project_type, location, timeline, description, budget, status, source, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (enquiryError) throw enquiryError;
    if (!enquiry) return { status: "not-found" };

    const [{ data: attachmentRows, error: attachmentsError }, { data: activityRows, error: activityError }] =
      await Promise.all([
        supabase.from("enquiry_attachments").select("file_name, storage_path, size_bytes").eq(
          "enquiry_id",
          id,
        ),
        supabase
          .from("ops_activity_log")
          .select("id, message, created_at")
          .eq("collection", "enquiries")
          .eq("record_id", id)
          .order("created_at", { ascending: false }),
      ]);
    if (attachmentsError) throw attachmentsError;
    if (activityError) throw activityError;

    const signedUrlByPath = new Map<string, string | null>();
    for (const row of (attachmentRows ?? []) as { storage_path: string }[]) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      signedUrlByPath.set(row.storage_path, signed?.signedUrl ?? null);
    }

    return {
      status: "ok",
      enquiry: buildEnquiryDetail(enquiry, attachmentRows ?? [], signedUrlByPath, activityRows ?? []),
    };
  } catch (error) {
    console.error("Could not load enquiry", id, error);
    return { status: "error" };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/features/enquiries/detail-view-model.test.ts src/features/enquiries/fetch-enquiry-detail.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/enquiries/detail-view-model.ts src/features/enquiries/detail-view-model.test.ts src/features/enquiries/fetch-enquiry-detail.ts src/features/enquiries/fetch-enquiry-detail.test.ts
git commit -m "feat: Enquiry detail view-model and data fetch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Detail page UI

**Files:**
- Create: `src/features/enquiries/components/enquiry-detail-tabs.tsx`
- Test: `src/features/enquiries/components/enquiry-detail-tabs.test.tsx`
- Create: `src/app/(app)/ops/enquiries/[id]/page.tsx`

**Interfaces:**
- Consumes: `Tabs` (Task 5), `StatusBadge`/`StatCard` (Task 1),
  `EnquiryDetail`/`fetchEnquiryDetail` (Task 6),
  `PageHeader`/`EmptyState`/`Button` (existing), `requireOpsUser` (existing).
- Produces: the page itself, at `/ops/enquiries/[id]`. No later task
  consumes this directly.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/enquiries/components/enquiry-detail-tabs.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnquiryDetailTabs } from "@/features/enquiries/components/enquiry-detail-tabs";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";

function detail(over: Partial<EnquiryDetail> = {}): EnquiryDetail {
  return {
    id: "e1",
    fullName: "Thandi Mokoena",
    company: "Blackridge Hotels",
    email: "thandi@example.com",
    phone: "0761234567",
    projectType: "Documentary",
    location: "Polokwane",
    timeline: "Next 1-3 months",
    description: "A short documentary series.",
    budget: "R20,000 - R35,000",
    status: "New",
    source: "Website",
    createdAt: "2026-09-27T10:00:00Z",
    attachments: [{ fileName: "brief.pdf", sizeBytes: 2_400_000, url: "https://signed.example/brief.pdf" }],
    activity: [{ id: "a1", message: "New project enquiry from Thandi Mokoena", relativeTime: "2 hours ago" }],
    ...over,
  };
}

describe("EnquiryDetailTabs", () => {
  it("shows the Overview tab's content by default, including the project type pill", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    expect(screen.getByText("A short documentary series.")).toBeInTheDocument();
    expect(screen.getByText("Documentary")).toBeInTheDocument();
  });

  it("shows the attachment count in the tab label and a working link on the Attachments tab", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Attachments \(1\)/ }));
    const link = screen.getByRole("link", { name: "brief.pdf" });
    expect(link).toHaveAttribute("href", "https://signed.example/brief.pdf");
  });

  it("shows every activity entry on the Activity tab", () => {
    render(<EnquiryDetailTabs enquiry={detail()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("New project enquiry from Thandi Mokoena")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", () => {
    render(<EnquiryDetailTabs enquiry={detail({ activity: [] })} />);
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("shows a real empty state on the Attachments tab when there are none", () => {
    render(<EnquiryDetailTabs enquiry={detail({ attachments: [] })} />);
    fireEvent.click(screen.getByRole("tab", { name: /Attachments \(0\)/ }));
    expect(screen.getByText("No attachments.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/features/enquiries/components/enquiry-detail-tabs.test.tsx`
Expected: FAIL — `Cannot find module '@/features/enquiries/components/enquiry-detail-tabs'`

- [ ] **Step 3: Write the component**

```tsx
// src/features/enquiries/components/enquiry-detail-tabs.tsx
import { Tabs } from "@/components/ui/tabs";
import type { EnquiryDetail } from "@/features/enquiries/detail-view-model";

function formatBytes(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} KB`;
}

export function EnquiryDetailTabs({ enquiry }: { enquiry: EnquiryDetail }) {
  return (
    <Tabs
      items={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="font-medium">Enquiry Overview</h3>
                <p className="text-ink-muted mt-2 text-sm whitespace-pre-line">{enquiry.description}</p>
              </div>
              <div>
                <h3 className="font-medium">Services Requested</h3>
                <span className="bg-line mt-2 inline-flex items-center px-2.5 py-1 text-xs font-medium">
                  {enquiry.projectType}
                </span>
              </div>
            </div>
          ),
        },
        {
          id: "attachments",
          label: `Attachments (${enquiry.attachments.length})`,
          content:
            enquiry.attachments.length === 0 ? (
              <p className="text-ink-muted text-sm">No attachments.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {enquiry.attachments.map((attachment) => (
                  <li key={attachment.fileName} className="border-line flex items-center justify-between border p-3 text-sm">
                    {attachment.url ? (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {attachment.fileName}
                      </a>
                    ) : (
                      <span>{attachment.fileName}</span>
                    )}
                    <span className="text-ink-muted">{formatBytes(attachment.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            ),
        },
        {
          id: "activity",
          label: `Activity (${enquiry.activity.length})`,
          content:
            enquiry.activity.length === 0 ? (
              <p className="text-ink-muted text-sm">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {enquiry.activity.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p>{entry.message}</p>
                    <p className="text-ink-muted text-xs">{entry.relativeTime}</p>
                  </li>
                ))}
              </ul>
            ),
        },
      ]}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/features/enquiries/components/enquiry-detail-tabs.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Write the detail page**

```tsx
// src/app/(app)/ops/enquiries/[id]/page.tsx
import { Calendar, FileText, Paperclip, Tag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusBadge } from "@/components/ops/status-badge";
import { EnquiryDetailTabs } from "@/features/enquiries/components/enquiry-detail-tabs";
import { fetchEnquiryDetail } from "@/features/enquiries/fetch-enquiry-detail";
import { requireOpsUser } from "@/lib/auth/guards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);
  if (result.status !== "ok") return { title: "Enquiry" };
  return { title: `${result.enquiry.company ?? result.enquiry.fullName} Enquiry` };
}

export default async function EnquiryDetailPage({ params }: Props) {
  await requireOpsUser();
  const { id } = await params;
  const result = await fetchEnquiryDetail(id);

  if (result.status === "not-found") notFound();

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Enquiry" description="Track incoming project requests." />
        <EmptyState title="This enquiry is temporarily unavailable">
          Something went wrong loading this page. Try refreshing in a moment.
        </EmptyState>
      </div>
    );
  }

  const { enquiry } = result;

  return (
    <div className="flex flex-col gap-8">
      <div className="text-ink-muted flex items-center gap-1 text-sm">
        <Link href="/ops/enquiries" className="hover:text-ink underline">
          Enquiries
        </Link>
        <span>/</span>
        <span>{enquiry.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <PageHeader
        title={`${enquiry.company ?? enquiry.fullName} Enquiry`}
        description={enquiry.fullName}
        actions={
          <Link href="/ops/enquiries">
            <Button variant="secondary">Back to Enquiries</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Tag} label="Status" value={<StatusBadge status={enquiry.status} />} />
        <StatCard icon={FileText} label="Service Type" value={enquiry.projectType} />
        <StatCard icon={Wallet} label="Budget" value={enquiry.budget ?? "Not specified"} />
        <StatCard icon={Calendar} label="Timeline" value={enquiry.timeline} />
        <StatCard icon={Paperclip} label="Attachments" value={enquiry.attachments.length} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <EnquiryDetailTabs enquiry={enquiry} />

        <div className="flex flex-col gap-6">
          <div className="border-line border p-5">
            <h3 className="font-medium">Enquiry Details</h3>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Enquiry ID</dt>
                <dd className="text-ink">{enquiry.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Client</dt>
                <dd className="text-ink">{enquiry.company ?? "Individual"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Contact</dt>
                <dd className="text-ink">{enquiry.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Project Type</dt>
                <dd className="text-ink">{enquiry.projectType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Source</dt>
                <dd className="text-ink">{enquiry.source}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Location</dt>
                <dd className="text-ink">{enquiry.location}</dd>
              </div>
            </dl>
          </div>

          <div className="border-line border p-5">
            <h3 className="font-medium">Contact Details</h3>
            <dl className="text-ink-muted mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Name</dt>
                <dd className="text-ink">{enquiry.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${enquiry.email}`} className="text-ink underline">
                    {enquiry.email}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${enquiry.phone}`} className="text-ink underline">
                    {enquiry.phone}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Company</dt>
                <dd className="text-ink">{enquiry.company ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manual smoke check**

With the dev server running, sign in as admin, open `/ops/enquiries`, click a
real row. Confirm: breadcrumb, title, stat cards, all three tabs render and
switch correctly, an attachment link opens its signed URL, activity entries
appear (for an enquiry submitted after Task 2's fix — an older test enquiry
submitted before that fix will correctly show "No activity recorded yet.",
since its log row predates the linkage). Also confirm an invalid id (e.g.
`/ops/enquiries/not-a-real-id`) renders the 404 page.

- [ ] **Step 7: Run the full gate suite**

Run: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all five pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/enquiries/components/enquiry-detail-tabs.tsx src/features/enquiries/components/enquiry-detail-tabs.test.tsx "src/app/(app)/ops/enquiries/[id]/page.tsx"
git commit -m "feat: Enquiry detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Documentation and ship

**Files:**
- Modify: `docs/architecture/application-architecture.md` (append a new
  section; do not edit existing sections)

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing further consumes this task; it is the final gate.

- [ ] **Step 1: Run the full gate suite one more time**

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all five pass with no errors. Fix anything that doesn't before
continuing — do not proceed with a red gate.

- [ ] **Step 2: Document this sub-project**

Append to `docs/architecture/application-architecture.md`:

```markdown

## Phase 5, sub-project 2 — Styled Enquiries page

The second piece of the OPS Command Center rebuild (see
`docs/superpowers/specs/2026-09-27-styled-enquiries-page-design.md`). Replaces
the bare `/ops/enquiries` verification page from sub-project 1 with a real
list page and a new `/ops/enquiries/[id]` detail page.

### What's new

- `/ops/enquiries`: stat cards (New/Reviewing/Quoted/Missing Attachments,
  plain counts), a filter tab per real status, client-side search and sort,
  a table with row selection (checking a row shows an inline preview;
  clicking it navigates to the detail page).
- `/ops/enquiries/[id]`: Overview/Attachments/Activity tabs, a stat-card row,
  and Enquiry Details / Contact Details right-rail panels.
- Three small, reusable primitives for future OPS modules: `StatusBadge`,
  `StatCard` (`src/components/ops/`), and a generic `Tabs`
  (`src/components/ui/`).
- Fixed a real gap: `submitProjectEnquiry`'s `ops_activity_log` insert now
  carries `collection`/`record_id`, so the Activity tab can filter to just
  its own enquiry (previously the insert had no way to be attributed to one).

### Deliberately different from the reference images

Matches `docs/design-references/enquiries.png` / `view-enquiry.png` in
layout, but not in content: uses the live 8-value `status` enum (not the
mockup's wording), renders `project_type` as one pill (not invented
multi-tag "Services"), and omits assignee/owner UI (no multi-staff team
concept exists yet), the Qualification Checklist, Communication tab, the
Follow-ups tab, and the Opportunity Snapshot (all depend on systems not yet
built). No trend deltas on stat cards (no status-history table exists).

### Deliberately unchanged

Write flows (Edit Enquiry, Qualify Enquiry, Export, manually creating an
enquiry) are not built — this sub-project makes the *read* side real.

### Still open

- Communication tab (needs the Inbox rebuild), Follow-ups tab (needs the
  Follow-ups module), Qualification Checklist, Routing & Ownership, and
  Opportunity Snapshot — each deferred to its own later sub-project once its
  backing system exists.
- The website nav/IA change and legacy form retirement remain unrelated,
  unstarted sub-projects.
```

- [ ] **Step 3: Commit and push**

```bash
git add docs/architecture/application-architecture.md
git commit -m "docs: styled Enquiries page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin next-migration
```

- [ ] **Step 4: Report to the user**

Summarise: what shipped (list + detail pages, the three new primitives, the
activity-log linkage fix), what was deliberately deferred (Communication,
Follow-ups, Qualification Checklist, Routing & Ownership, Opportunity
Snapshot, all write flows), and confirm all gates are green.
