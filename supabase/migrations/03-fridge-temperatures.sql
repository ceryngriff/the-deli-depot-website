-- =========================================================
-- Migration 03: Fridge / chiller temperature logs
-- Staff log fridge & freezer temperatures as evidence for
-- Environmental Health Officer (EHO) inspections.
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (uses `if not exists` / `drop policy if exists`).
-- =========================================================

create table if not exists public.fridge_temperature_logs (
  id            uuid primary key default gen_random_uuid(),
  unit_name     text not null,                       -- e.g. 'Main Fridge', 'Display Chiller'
  unit_type     text not null default 'fridge'
                  check (unit_type in ('fridge','freezer')),
  temperature_c numeric(4,1) not null,               -- reading in °C (allows negatives)
  reading_at    timestamptz not null default now(),  -- when the reading was taken
  staff_name    text not null,                       -- who took it (name or initials)
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists fridge_temp_logs_reading_idx
  on public.fridge_temperature_logs (reading_at desc);

-- Admin-only: this is internal compliance data, never customer-facing.
alter table public.fridge_temperature_logs enable row level security;

drop policy if exists "fridge_temps_admin_all" on public.fridge_temperature_logs;
create policy "fridge_temps_admin_all"
  on public.fridge_temperature_logs
  for all using (public.is_admin())
  with check (public.is_admin());

-- =========================================================
-- DONE
-- The /admin/fridge-temperatures.html page reads & writes this
-- table via the standard authenticated admin session.
-- =========================================================
