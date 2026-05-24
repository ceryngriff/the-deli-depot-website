-- =========================================================
-- Migration 01: Slot capacities
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (uses `if not exists` / `on conflict do nothing`).
-- =========================================================

-- One row per (weekday, time-of-day) slot, with a configurable cap.
-- Rows with no entry are treated as "no cap" (allow any number of orders).
create table if not exists public.slot_capacities (
  id          uuid primary key default gen_random_uuid(),
  weekday     text not null check (weekday in
                ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  time_slot   text not null,                 -- 'HH24:MI' (e.g. '12:00')
  max_orders  int  not null default 20 check (max_orders >= 0),
  created_at  timestamptz not null default now(),
  unique (weekday, time_slot)
);

alter table public.slot_capacities enable row level security;

drop policy if exists "slot_caps_public_read" on public.slot_capacities;
create policy "slot_caps_public_read"
  on public.slot_capacities
  for select using (true);

drop policy if exists "slot_caps_admin_all" on public.slot_capacities;
create policy "slot_caps_admin_all"
  on public.slot_capacities
  for all using (public.is_admin())
  with check (public.is_admin());

-- Seed: default cap of 20 for every weekday × time slot we currently offer.
-- Ceryn can edit each row later in Supabase Table Editor (or admin UI).
insert into public.slot_capacities (weekday, time_slot, max_orders)
select w, t, 20
from (values ('monday'),('tuesday'),('wednesday'),('thursday'),('friday'),('saturday'))
       as wd(w)
cross join (values ('08:00'),('12:00'),('17:00'),('19:00')) as ts(t)
on conflict (weekday, time_slot) do nothing;

-- =========================================================
-- RPC: slot_availability(p_date date)
-- Returns one row per time slot configured for that weekday,
-- with the count of orders already booked in and the cap.
-- SECURITY DEFINER bypasses RLS so anon callers get a real count
-- (we don't expose any other order data).
-- =========================================================

create or replace function public.slot_availability(p_date date)
returns table(time_slot text, used int, max_orders int)
language sql
security definer
set search_path = public
stable
as $$
  with caps as (
    select sc.time_slot, sc.max_orders
    from public.slot_capacities sc
    where sc.weekday = trim(lower(to_char(p_date, 'day')))
  ),
  used as (
    select to_char(collection_slot, 'HH24:MI') as time_slot,
           count(*)::int as cnt
    from public.orders
    where collection_slot::date = p_date
      and status != 'cancelled'
    group by to_char(collection_slot, 'HH24:MI')
  )
  select c.time_slot,
         coalesce(u.cnt, 0) as used,
         c.max_orders
  from caps c
  left join used u on u.time_slot = c.time_slot
  order by c.time_slot;
$$;

grant execute on function public.slot_availability(date) to anon, authenticated;

-- =========================================================
-- DONE
-- After running, you can edit any cap in the Supabase Table
-- Editor: Tables → slot_capacities → change max_orders.
-- =========================================================
