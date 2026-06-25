-- =========================================================
-- Migration 05: Delivery checks
-- Staff record a food-safety check on every delivery (supplier,
-- packaging, date codes, allergen labelling, chilled/frozen probe
-- temperatures, and whether it was accepted or rejected) as
-- evidence for Environmental Health Officer (EHO) inspections.
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (uses `if not exists` / `drop policy if exists`).
-- =========================================================

create table if not exists public.delivery_checks (
  id             uuid primary key default gen_random_uuid(),
  checked_at     timestamptz not null default now(),
  staff_name     text not null,
  supplier       text not null,
  items_received text,                              -- what was delivered
  packaging_ok   boolean not null default false,   -- packaging intact & undamaged
  dates_ok       boolean not null default false,    -- all items in date
  labels_ok      boolean not null default false,    -- allergen / ingredient labelling correct
  no_damage      boolean not null default false,    -- no contamination / pest damage
  chilled_temp_c numeric(4,1),                       -- probe temp of chilled goods (optional)
  frozen_temp_c  numeric(4,1),                       -- probe temp of frozen goods (optional)
  outcome        text not null default 'accepted'
                   check (outcome in ('accepted','accepted_with_note','rejected')),
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists delivery_checks_checked_at_idx
  on public.delivery_checks (checked_at desc);

-- ---------- ROW LEVEL SECURITY (admin-only) ----------
alter table public.delivery_checks enable row level security;

drop policy if exists "delivery_checks_admin_all" on public.delivery_checks;
create policy "delivery_checks_admin_all"
  on public.delivery_checks
  for all using (public.is_admin())
  with check (public.is_admin());

-- =========================================================
-- DONE
-- The /admin/delivery-checks.html page reads & writes this
-- table via the standard authenticated admin session.
-- =========================================================
