-- =========================================================
-- Migration 04: Opening & Closing daily checks
-- Staff record opening / closing food-safety checks (plus the
-- fridge & freezer temperatures taken at the same time) as
-- evidence for Environmental Health Officer (EHO) inspections.
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (uses `if not exists` / `drop policy if exists`).
-- =========================================================

-- ---------- OPENING CHECKS ----------
create table if not exists public.opening_checks (
  id               uuid primary key default gen_random_uuid(),
  checked_at       timestamptz not null default now(),
  staff_name       text not null,
  surfaces_clean   boolean not null default false,  -- surfaces & equipment clean and ready
  date_labels_ok   boolean not null default false,  -- date labels in order / no out-of-date stock
  handwash_stocked boolean not null default false,  -- handwashing station stocked (soap & towels)
  pest_check_ok    boolean not null default false,  -- no signs of overnight pest activity
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------- CLOSING CHECKS ----------
create table if not exists public.closing_checks (
  id               uuid primary key default gen_random_uuid(),
  checked_at       timestamptz not null default now(),
  staff_name       text not null,
  food_covered     boolean not null default false,  -- all food covered and stored correctly
  surfaces_cleaned boolean not null default false,  -- surfaces cleaned down
  bins_emptied     boolean not null default false,  -- bins emptied
  equipment_off    boolean not null default false,  -- equipment switched off / locked down
  doors_secured    boolean not null default false,  -- doors and windows secured
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------- TEMPERATURE READINGS (linked to either check) ----------
create table if not exists public.check_temperature_readings (
  id               uuid primary key default gen_random_uuid(),
  opening_check_id uuid references public.opening_checks(id) on delete cascade,
  closing_check_id uuid references public.closing_checks(id) on delete cascade,
  unit_name        text not null,
  unit_type        text not null default 'fridge'
                     check (unit_type in ('fridge','freezer')),
  temperature_c    numeric(4,1) not null,
  created_at       timestamptz not null default now(),
  -- a reading belongs to exactly one parent check
  constraint check_temp_one_parent check (
    (opening_check_id is not null)::int + (closing_check_id is not null)::int = 1
  )
);

create index if not exists check_temp_opening_idx
  on public.check_temperature_readings (opening_check_id);
create index if not exists check_temp_closing_idx
  on public.check_temperature_readings (closing_check_id);

-- ---------- ROW LEVEL SECURITY (admin-only) ----------
alter table public.opening_checks             enable row level security;
alter table public.closing_checks             enable row level security;
alter table public.check_temperature_readings enable row level security;

drop policy if exists "opening_checks_admin_all" on public.opening_checks;
create policy "opening_checks_admin_all"
  on public.opening_checks
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "closing_checks_admin_all" on public.closing_checks;
create policy "closing_checks_admin_all"
  on public.closing_checks
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "check_temps_admin_all" on public.check_temperature_readings;
create policy "check_temps_admin_all"
  on public.check_temperature_readings
  for all using (public.is_admin())
  with check (public.is_admin());

-- =========================================================
-- DONE
-- The /admin/opening-closing-checks.html page reads & writes
-- these tables via the standard authenticated admin session.
-- =========================================================
