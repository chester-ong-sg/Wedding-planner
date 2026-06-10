# AI Wedding Plan — Architecture

How the onboarding flow turns three answers into a personalised, editable Singapore wedding plan, and how that plan is persisted and rendered.

---

## Overview

```
┌─────────────┐   POST    ┌──────────────────────┐   Messages API   ┌──────────────┐
│ /onboarding │ ────────▶ │ /api/generate-plan   │ ───────────────▶ │  Anthropic   │
│  (3 Qs)     │           │  (server route)      │  claude-sonnet-4-6│   API        │
└─────────────┘           └──────────────────────┘                  └──────────────┘
       │                            │                                       │
       │                            │  GeneratedPlan JSON (validated)       │
       │                            ◀───────────────────────────────────────┘
       │                            │
       │       ┌────────────────────┴───────────────────────┐
       │       │ dev:  localStorage                          │
       │       │ prod: Supabase (RLS, per-user)              │
       │       └────────────────────┬───────────────────────┘
       ▼                            ▼
   live checklist             ┌─────────────┐
   animation                  │ /dashboard  │  ◀── renders the saved plan
                              └─────────────┘
```

---

## 1. Onboarding (`app/onboarding/page.tsx`)

A single client component with a `step` state machine:

```
"date" → "guests" → "type" → "loading" → "done"
```

- **date** — shadcn `Calendar` in a `Popover`, two-month Airbnb-style view with month/year dropdowns (`captionLayout="dropdown-buttons"`, year range = current year + 6). Past dates disabled. The popover opens downward (`side="bottom"`, `avoidCollisions={false}`) and the step content sits in the upper third so the calendar never clips the viewport top.
- **guests** — number stepper with `60 / 120 / 200 / 300` quick presets.
- **type** — `rom_only` | `banquet_only` | `rom_and_banquet`.

### Live generation checklist

While `step === "loading"`, `GEN_STEPS` (7 themed items) tick off one at a time:

- A timer advances `completedSteps` every `STEP_INTERVAL_MS` (7s), **capped at the last index** so the final step stays "in progress".
- When the real API response lands, `finishSteps()` sets `genComplete = true` and `completedSteps = GEN_STEPS.length` — every step flips to a green check, with a 0.9s beat before redirecting.
- This keeps the animation honest: it never shows "done" before the plan actually exists. Because generation is a single request (no streaming of partial sections), the intermediate steps are timed rather than tied to real per-section progress; only the terminal state is gated on the response.

---

## 2. Generation route (`app/api/generate-plan/route.ts`)

Server-only POST handler. The Anthropic key never reaches the client.

| Concern | Behaviour |
|---|---|
| Model | `claude-sonnet-4-6` |
| `max_tokens` | `8000` — enough for a bounded plan; the route returns a 500 if `stop_reason === "max_tokens"` rather than parsing truncated JSON |
| No API key | Returns a built-in `MOCK_PLAN` so the UI works offline |
| JSON parsing | Strips markdown fences, then slices from the first `{` to the last `}` before `JSON.parse` |

### Prompt design

The prompt injects a **real Singapore wedding reference** (`REAL_REFERENCE`) derived from an actual ~178-guest banquet:

- Anchored vendor costs (ballroom ~$185–195/pax, photo+video, makeup, emcee, florist, transport…).
- The real day-of timeline (gate-crash → prayers/tangyuan → tea ceremony → cocktail → march-ins → games → stage photos → after-party).
- Seating reality (10 pax/table, VIP table, family-branch clustering) and "things couples forget" (angpao box + collector, parking coupons, AV laptops, etc.).

Rules tell the model to **scale the ballroom line with guest count** while keeping fixed vendor fees flat, and to **respect the wedding type** (ROM-only skips banquet logistics, etc.). Output is **bounded** (5–6 checklist sections × 3–5 tasks, 5–6 budget categories × 3–5 items, 4–6 milestones) to keep generation fast (~60–75s) and focused.

> Customers should set a spend limit in the Anthropic console. Each onboarding costs roughly $0.01–$0.02.

---

## 3. Data model (`types/dashboard.ts`)

```ts
type WeddingType = 'rom_only' | 'banquet_only' | 'rom_and_banquet'

interface GeneratedPlan {
  checklist:  { month_label: string; tasks: { task; category?; notes? }[] }[]
  budget:     { category: string; items: { item_name; estimated_amount; notes? }[] }[]
  milestones: { title; due_date; description }[]
}
```

The flat `GeneratedPlan` (what the AI returns) is expanded into per-row records on save:

| Supabase table | Maps from | Key columns |
|---|---|---|
| `user_profiles` | onboarding answers | `wedding_date`, `guest_count`, `wedding_type`, `onboarding_completed` |
| `checklist_items` | `checklist[].tasks[]` | `month_label`, `task`, `category`, `is_completed`, `sort_order` |
| `budget_items` | `budget[].items[]` | `category`, `item_name`, `estimated_amount`, `actual_amount`, `sort_order` |
| `milestones` | `milestones[]` | `title`, `due_date`, `is_completed`, `sort_order` |

All four tables have RLS enabled with per-user (`auth.uid()`) policies — see `scripts/onboarding-migration.sql`.

---

## 4. Persistence: dev vs prod

Persistence is keyed on `process.env.NODE_ENV`, **not** on whether Supabase is configured:

- **`isDev` (development)** — the plan and onboarding answers are written to `localStorage` (`dev_wedding_plan`, `dev_onboarding`). No login, no SQL migration required. This is intentional so the full flow is testable locally even with real Supabase keys present.
- **production** — the plan is upserted to Supabase under the logged-in user; the dashboard reads it back and redirects to `/onboarding` if `onboarding_completed` is false.

> Historically the dev path was gated on `isDev && !supabase`, which broke once real Supabase keys were added (the app tried to write to tables that didn't exist and the dashboard bounced back to onboarding). It is now gated on `isDev` alone in both `app/onboarding/page.tsx` and `app/dashboard/page.tsx`.

---

## 5. Dashboard (`app/dashboard/page.tsx`)

- Loads from `localStorage` (dev) or Supabase (prod); redirects to `/onboarding` if no completed plan exists.
- Renders three sections under the **Wedding Plan** tab:
  - `MilestonesSection` — sorted by due date, toggle complete, inline title edit, countdown badge.
  - `ChecklistSection` — accordion by `month_label`, category colour badges, progress bar, inline task edit.
  - `BudgetSection` — table with category subtotals + grand total, every cell inline-editable, actuals coloured by over/under estimate.
- All edits are **optimistic**: React state updates immediately, then persists (Supabase in prod; dev write-back is a known TODO).

---

## Routing & auth summary

| Route | Purpose | Auth behaviour |
|---|---|---|
| `/onboarding` | 3-Q flow + generation | dev: open; prod: requires session, redirects to `/dashboard` if already onboarded |
| `/dashboard` | Plan home (tabs) | dev: open; prod: requires session, redirects to `/onboarding` if not onboarded |
| `/planner` | Seating canvas | unchanged from v0.3.0; "Back to Dashboard" link added to the header |

Login/register redirect to `/dashboard` or `/onboarding` based on `user_profiles.onboarding_completed`.
