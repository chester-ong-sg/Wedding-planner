-- Wedding Planner: Onboarding & AI Plan tables
-- Run this in the Supabase SQL editor

-- ─── user_profiles ───────────────────────────────────────────────────────────
create table if not exists user_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  wedding_date         date,
  guest_count          integer,
  wedding_type         text check (wedding_type in ('rom_only', 'banquet_only', 'rom_and_banquet')),
  onboarding_completed boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "Users manage their own profile"
  on user_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── checklist_items ─────────────────────────────────────────────────────────
create table if not exists checklist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  month_label  text not null,
  task         text not null,
  category     text,
  is_completed boolean default false,
  due_date     date,
  notes        text,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

alter table checklist_items enable row level security;

create policy "Users manage their own checklist"
  on checklist_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists checklist_items_user_id_idx on checklist_items(user_id);

-- ─── budget_items ─────────────────────────────────────────────────────────────
create table if not exists budget_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  category         text not null,
  item_name        text not null,
  estimated_amount integer not null default 0,  -- SGD, whole dollars
  actual_amount    integer,
  notes            text,
  sort_order       integer default 0,
  created_at       timestamptz default now()
);

alter table budget_items enable row level security;

create policy "Users manage their own budget"
  on budget_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists budget_items_user_id_idx on budget_items(user_id);

-- ─── milestones ──────────────────────────────────────────────────────────────
create table if not exists milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  due_date     date,
  description  text,
  is_completed boolean default false,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

alter table milestones enable row level security;

create policy "Users manage their own milestones"
  on milestones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists milestones_user_id_idx on milestones(user_id);
