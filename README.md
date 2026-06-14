# Wedding Planner

[![Deploy to GitHub Pages](https://github.com/chester-ong-sg/Wedding-planner/actions/workflows/nextjs.yml/badge.svg)](https://github.com/chester-ong-sg/Wedding-planner/actions/workflows/nextjs.yml)
![Version](https://img.shields.io/badge/version-0.4.0-blue)

A web application for planning a Singapore wedding end to end. Answer three questions and an AI generates a personalised, fully-editable plan — a month-by-month checklist, an SGD budget breakdown, and key milestones grounded in real Singapore Chinese wedding customs. Then arrange your seating on an infinite drag-and-drop canvas.

---

## What's New in v0.4.0

- **AI-powered onboarding** — a 3-question flow (date, guest count, wedding type) that generates a complete, Singapore-specific wedding plan via the Anthropic API.
- **Dashboard** — a new `/dashboard` home with tabs for **Wedding Plan** (milestones, checklist, budget) and **Seating Planner**.
- **Fully editable plan** — every checklist task, budget line, and milestone is inline-editable; budget actuals turn red when over the estimate.
- **Table / Grid view toggle** in the seating planner sidebar, plus Email & Contact columns in the spreadsheet view.
- **Airbnb-style date picker** with month/year dropdowns for fast navigation.

---

## Features

### AI Wedding Plan

- **Onboarding** (`/onboarding`): three questions presented one at a time —
  1. Wedding date (calendar picker)
  2. Guest count (stepper + quick presets)
  3. Wedding type (ROM only / Banquet only / ROM + Banquet)
- **Live generation checklist**: while the plan generates, themed steps tick off one by one (择日 → 敬茶 → checklist → budget → 闯门 → items to bring → milestones), with the final step gated on the real API response.
- **Singapore-grounded output**: estimates and timelines are anchored to real local wedding data — hotel ballroom pricing (~$185–195/pax), vendor fee ranges, the gate-crash → tea ceremony → march-in → banquet day-of flow, and customs (择日, 过大礼, 闯门, 敬茶, angpao, ROM).
- **Wedding-type aware**: ROM-only plans skip banquet logistics; banquet-only plans skip ROM tasks.

### Dashboard

- **Hero strip**: wedding date, guest count, type, and a live countdown.
- **Wedding Plan tab**:
  - **Key Milestones** — dated, toggleable, with "Xd away / Today / Overdue" badges.
  - **Checklist** — grouped by time period (accordion), category colour badges, overall progress bar; inline-editable tasks.
  - **Budget** — itemised table (Item / Estimated SGD / Actual SGD / Notes), category subtotals, grand total; every cell inline-editable, actuals coloured by over/under.
- **Seating Planner tab** — opens the canvas planner below.

### Seating Planner — Canvas

- Infinite pannable, zoomable canvas (10%–200% zoom)
- Scroll wheel to zoom; click-drag or middle-click to pan
- Tables snap to a 40px grid aligned to visible gridlines
- **Double-click** a table to open its guest list
- **Right-click** a table for context menu: Guest List, Edit, Delete

### Seating Planner — Table & Guest Management

- Add tables with custom name, capacity (1–20), and shape (round / square / rectangular)
- Drag and reposition tables freely on the canvas
- Delete confirmation shows how many guests will be unassigned
- Add guests with name, email, contact, dietary restrictions, and RSVP status
- RSVP statuses: **Pending** (gray) · **Accepted** (green) · **Declined** (red)
- Drag guests from the sidebar onto any table to assign them
- Search guests by name across all tables

### Grid / Table View Toggle

- **Grid view** (default): guests grouped by table in an accordion sidebar over the canvas.
- **Table view**: hides the canvas and expands the sidebar to a full-width spreadsheet of all guests with sortable, filterable columns (Name, Table, RSVP, Email, Contact, Dietary). Every cell is inline-editable; Import/Export move beside Add Guest / Add Table.

### CSV Import / Export

- Import format:

  ```
  "Name","Email","Contact","Dietary Restrictions","RSVP Status","Table"
  "James Lim","james.lim@gmail.com","+65 9123 4567","None","accepted","VIP Table 1"
  ```

- Headers are case-insensitive and space-tolerant (`"RSVP Status"` = `rsvp_status`)
- A sample file is included at `sample-guests.csv` (100 guests across 9 tables)
- Export downloads the current guest list as a CSV

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| AI | Anthropic API (`@anthropic-ai/sdk`, `claude-haiku-4-5`) via a server-side route |
| Drag & Drop | React DnD (guests) + custom mouse events (tables) |
| Database & Auth | Supabase (PostgreSQL + Auth, RLS) |
| Deployment | GitHub Pages via GitHub Actions |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/chester-ong-sg/Wedding-planner.git
cd Wedding-planner
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
ANTHROPIC_API_KEY=sk-ant-...
```

- Supabase keys: dashboard → **Settings → API**.
- `ANTHROPIC_API_KEY`: [console.anthropic.com](https://console.anthropic.com) → **API Keys**. Kept **server-side only** (used in `app/api/generate-plan/route.ts`); never exposed to the client. If unset, the API route returns a built-in mock plan so the UI still works.

### 3. Set up the database

Run the planner migrations in `supabase/migrations/`, then the AI-plan migration:

```bash
supabase db push
# then, in the Supabase SQL editor, run:
#   scripts/onboarding-migration.sql
```

`scripts/onboarding-migration.sql` creates four RLS-protected tables: `user_profiles`, `checklist_items`, `budget_items`, `milestones`.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Dev mode (no auth / no migration required):** In development the app persists the generated plan and seating data to `localStorage` instead of Supabase, so you can run the full onboarding → dashboard → planner flow without logging in or running the SQL migration. The Anthropic key is still used (server-side) to generate real plans. Data resets when you clear browser storage.

---

## How the AI Plan Generation Works

```
/onboarding  ──POST──▶  /api/generate-plan  ──▶  Anthropic API (claude-haiku-4-5)
   (3 Qs)                  (server route,            │
                            holds API key)           ▼
                                              GeneratedPlan JSON
                                                     │
        dev: localStorage  ◀────────────────────────┤
        prod: Supabase (user_profiles, checklist_items, budget_items, milestones)
                                                     │
                                                     ▼
                                               /dashboard
```

- The prompt is bounded (5 checklist sections, 5 budget categories, 4–5 milestones, terse text) and anchored to a real Singapore wedding reference so estimates scale sensibly with guest count. Generation takes ~40s.
- `max_tokens` is capped at 5000 and the route rejects truncated responses rather than returning broken JSON. Token usage is logged per call.
- **Cost:** ~1.4 cents per onboarding on `claude-haiku-4-5` (~1,400 input + ~2,400 output tokens). Output tokens dominate, so the prompt keeps generated text terse. Set a spend limit in the Anthropic console.
- See `app/api/generate-plan/route.ts` for the prompt and reference data, and `docs/ai-wedding-plan.md` for the full subsystem write-up.

---

## Project Structure

```
app/
  layout.tsx              # Root layout (Supabase provider, Toaster)
  page.tsx                # Landing page
  onboarding/page.tsx     # 3-question AI onboarding + live generation checklist
  dashboard/
    layout.tsx            # Dashboard header
    page.tsx              # Plan tabs (Wedding Plan / Seating Planner)
  planner/
    layout.tsx            # Sticky header
    page.tsx              # Seating canvas + all CRUD logic
  api/generate-plan/route.ts   # Server route — Anthropic call, SG grounding prompt
  login/page.tsx
  register/page.tsx
  auth/callback/route.ts

components/
  header.tsx              # Planner nav (Back to Dashboard, Sign Out)
  dashboard-header.tsx    # Dashboard nav (Wedding Plan / Seating Planner)
  dashboard/
    milestones-section.tsx
    checklist-section.tsx
    budget-section.tsx
  planner/
    sidebar-with-edit.tsx # Guest sidebar, grid/table toggle, bulk select
    table-component.tsx   # Canvas table node + context menu + guest dialog
    csv-import.tsx
    export-csv.tsx
    guest-form.tsx
  ui/                     # Shadcn UI components

types/
  planner.ts              # Table, Guest, RSVPStatus types
  dashboard.ts            # UserProfile, ChecklistItem, BudgetItem, Milestone, GeneratedPlan

scripts/
  onboarding-migration.sql  # Creates the 4 AI-plan tables with RLS

docs/
  ai-wedding-plan.md      # AI plan subsystem architecture & data model

sample-guests.csv         # 100 mock guests across 9 tables
```

---

## Deployment

The app deploys automatically to GitHub Pages on every push to `main`.

Live URL: [https://chester-ong-sg.github.io/Wedding-planner/](https://chester-ong-sg.github.io/Wedding-planner/)

To deploy your own instance:
1. Fork this repository
2. Add GitHub repository secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
3. Push to `main` — GitHub Actions handles the rest

---

## Roadmap

- **Split the plan into individual menu/line items** — break each generated section into granular, separately-editable items (planned).
- Persist dashboard inline edits back to `localStorage` in dev mode.
- Auth guards on `/login` and `/register` for already-authenticated users.
- Server-side middleware protection for `/planner` and `/dashboard`.

---

## Known Limitations

- Dev-mode dashboard edits update React state but are not yet written back to `localStorage` (revert on reload).
- Guest login uses hardcoded credentials (`guest@gmail.com` / `guest123`).
- Plan generation is a single ~60–75s request (no streaming of partial results).
- Desktop-first layout.

---

## License

MIT — see [LICENSE](LICENSE) for details.
