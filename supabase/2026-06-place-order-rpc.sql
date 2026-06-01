-- =========================================================
-- FIX: guest checkout blocked by Row Level Security
-- =========================================================
-- Symptom: placing an order failed with
--   "new row violates row-level security policy for table orders"
--
-- Cause: a not-signed-in (guest) customer has no auth identity, so the
-- owner-scoped INSERT/SELECT policies on `orders` reject both the insert
-- and the read-back of the new row.
--
-- Fix: do the whole order creation inside ONE SECURITY DEFINER function.
-- It runs with the table owner's rights (so RLS doesn't block it), but the
-- logic is fully server-controlled — the browser can only create a normal
-- 'pending' / 'unpaid' order for itself, nothing else. It returns the new
-- order id + order_number so the confirmation page has them.
--
-- HOW TO APPLY (one time):
--   Supabase dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run. Safe to run more than once.
-- =========================================================

create or replace function public.place_order(
  p_email          text,
  p_name           text,
  p_phone          text,
  p_collection_slot timestamptz,
  p_subtotal       numeric,
  p_total          numeric,
  p_notes          text,
  p_items          jsonb
)
returns table (id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_num text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot place an order with no items';
  end if;

  insert into public.orders
    (customer_id, customer_email, customer_name, customer_phone,
     status, collection_slot, subtotal, total, notes, payment_status)
  values
    (auth.uid(), p_email, p_name, p_phone,
     'pending', p_collection_slot, p_subtotal, p_total, nullif(p_notes, ''), 'unpaid')
  returning orders.id, orders.order_number into v_id, v_num;

  insert into public.order_items
    (order_id, meal_id, meal_name, bundle_type,
     quantity, unit_price, line_total, build_details, macros)
  select
    v_id,
    nullif(it->>'meal_id', '')::uuid,
    it->>'meal_name',
    it->>'bundle_type',
    (it->>'quantity')::int,
    (it->>'unit_price')::numeric,
    (it->>'line_total')::numeric,
    nullif(it->'build_details', 'null'::jsonb),
    nullif(it->'macros', 'null'::jsonb)
  from jsonb_array_elements(p_items) as it;

  return query select v_id, v_num;
end;
$$;

-- Only the app roles may call it; the function itself enforces the rest.
revoke all     on function public.place_order(text,text,text,timestamptz,numeric,numeric,text,jsonb) from public;
grant  execute on function public.place_order(text,text,text,timestamptz,numeric,numeric,text,jsonb) to anon, authenticated;
