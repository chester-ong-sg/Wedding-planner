# Wedding Planner

[![Deploy to GitHub Pages](https://github.com/chester-ong-sg/Wedding-planner/actions/workflows/nextjs.yml/badge.svg)](https://github.com/chester-ong-sg/Wedding-planner/actions/workflows/nextjs.yml)
![Version](https://img.shields.io/badge/version-0.3.0-blue)

A web application for planning wedding seating arrangements — drag tables onto an infinite canvas, assign guests, import guest lists via CSV, and edit everything inline.

---

## Features

### Canvas
- Infinite pannable, zoomable canvas (10%–200% zoom)
- Scroll wheel to zoom; click-drag or middle-click to pan
- Tables snap to a 40px grid aligned to visible gridlines
- **Double-click** a table to open its guest list
- **Right-click** a table for context menu: Guest List, Edit, Delete

### Table Management
- Add tables with custom name, capacity (1–20), and shape (round / square / rectangular)
- Drag and reposition tables freely on the canvas
- Delete confirmation shows how many guests will be unassigned

### Guest Management
- Add guests individually with name, email, contact, dietary restrictions, and RSVP status
- RSVP statuses: **Pending** (gray) · **Accepted** (green) · **Declined** (red)
- Drag guests from the sidebar onto any table to assign them
- Search guests by name across all tables

### Guest List Dialog
- Opens via right-click → Guest List, or double-click on the table
- Full table view: Name, Email, Contact, Dietary Restrictions, RSVP
- **Inline editing**: double-click any cell to edit; click away to confirm
- RSVP status editable via dropdown in the same row
- Changes auto-save when the dialog is closed ("Changes saved" toast)

### Bulk Operations
- Checkboxes on each guest row and table accordion header
- Bulk delete guests or tables with a single confirmation dialog

### CSV Import / Export
- Import format:

  ```
  "Name","Email","Contact","Dietary Restrictions","RSVP Status","Table"
  "James Lim","james.lim@gmail.com","+65 9123 4567","None","accepted","VIP Table 1"
  ```

- Headers are case-insensitive and space-tolerant (`"RSVP Status"` = `rsvp_status`)
- A sample file is included at `sample-guests.csv` (100 guests across 9 tables)
- Export downloads the current guest list as a CSV

### Toolbar (Figma-style, centre-bottom)
| Icon | Action |
|------|--------|
| `+` / `−` | Zoom in / out |
| ⤢ | Fit to screen |
| ↩ / ↪ | Undo / Redo |
| ↑ | Import CSV |
| ↓ | Export CSV |

Keyboard shortcuts: `Ctrl+Z` undo · `Ctrl+Shift+Z` redo

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| Drag & Drop | React DnD (guests) + custom mouse events (tables) |
| Database & Auth | Supabase (PostgreSQL + Auth) |
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
```

Get these from your Supabase dashboard → **Settings → API**.

### 3. Set up the database

Run the migration files in `supabase/migrations/` against your Supabase project:

```bash
supabase db push
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Dev mode (no Supabase):** The app runs without credentials and stores all data in memory. Use the Import CSV button to load `sample-guests.csv` for testing. Data resets on page reload.

---

## Project Structure

```
app/
  layout.tsx          # Root layout (Supabase provider, Toaster)
  page.tsx            # Landing page
  planner/
    layout.tsx        # Sticky header
    page.tsx          # Main planner canvas + all CRUD logic
  login/page.tsx
  register/page.tsx
  auth/callback/route.ts

components/
  header.tsx          # Sticky nav with Sign Out
  planner/
    sidebar-with-edit.tsx   # Guest sidebar, bulk select, accordion
    table-component.tsx     # Canvas table node + context menu + guest dialog
    csv-import.tsx          # Import button + parser
    export-csv.tsx          # Export button
    guest-form.tsx          # Add/Edit guest form
  ui/                 # Shadcn UI components

utils/
  supabase/
    client.ts         # Browser client factory
    server.ts         # Server component client factory
    middleware.ts     # Middleware client (cookie chaining)

types/
  planner.ts          # Table, Guest, RSVPStatus types

sample-guests.csv     # 100 mock guests across 9 tables
```

---

## Deployment

The app deploys automatically to GitHub Pages on every push to `main`.

Live URL: [https://chester-ong-sg.github.io/Wedding-planner/](https://chester-ong-sg.github.io/Wedding-planner/)

To deploy your own instance:
1. Fork this repository
2. Add GitHub repository secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Push to `main` — GitHub Actions handles the rest

---

## Known Limitations (Backlog)

- Auth guards on `/login` and `/register` for already-authenticated users
- Server-side middleware protection for `/planner` (currently client-side only)
- Dev-mode state resets on hot reload (connect Supabase to persist)
- Guest login uses hardcoded credentials (`guest@gmail.com` / `123`)

---

## License

MIT — see [LICENSE](LICENSE) for details.
