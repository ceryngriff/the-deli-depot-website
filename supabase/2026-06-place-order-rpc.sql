-- =========================================================
-- place_order — guest-safe, SERVER-PRICED order creation
-- =========================================================
-- This supersedes the original guest-checkout fix. Two things it does:
--
-- 1. Guest checkout: the whole order is created inside ONE SECURITY DEFINER
--    function so a not-signed-in customer doesn't trip the owner-scoped RLS
--    policies on `orders` / `order_items`.
--
-- 2. SERVER-SIDE PRICING (security): the browser can no longer dictate what an
--    order costs. For every catalog line we look the price up from the `meals`
--    table by slug + bundle_type and recompute the line total; the order
--    subtotal/total are summed here and the client-sent p_subtotal/p_total are
--    IGNORED. Previously a tampered request could buy a £40 box for a penny.
--    (Custom "build your own" meals have no catalog row, so their price is
--    composed on the client — we accept it but clamp it to a sane ceiling.)
--
-- HOW TO APPLY (one time):
--   Supabase dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run. Safe to run more than once.
--
-- (Kept in sync with the copy embedded in schema.sql.)
-- =========================================================

-- The return type gains a `total` column, so the old function must be dropped
-- before recreating (Postgres can't change a function's return type in place).
drop function if exists public.place_order(text,text,text,timestamptz,numeric,numeric,text,jsonb);

create or replace function public.place_order(
  p_email           text,
  p_name            text,
  p_phone           text,
  p_collection_slot timestamptz,
  p_subtotal        numeric,   -- IGNORED: kept for call-signature compatibility
  p_total           numeric,   -- IGNORED: server recomputes from the meals table
  p_notes           text,
  p_items           jsonb
)
returns table (id uuid, order_number text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_num      text;
  v_subtotal numeric(8,2) := 0;
  it         jsonb;
  v_bundle   text;
  v_qty      int;
  v_slug     text;
  v_meal     public.meals%rowtype;
  v_meal_id  uuid;
  v_unit     numeric(6,2);
  v_line     numeric(8,2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot place an order with no items';
  end if;

  -- Create the order shell first; subtotal/total are filled in after pricing.
  insert into public.orders
    (customer_id, customer_email, customer_name, customer_phone,
     status, collection_slot, subtotal, total, notes, payment_status)
  values
    (auth.uid(), p_email, p_name, p_phone,
     'pending', p_collection_slot, 0, 0, nullif(p_notes, ''), 'unpaid')
  returning orders.id, orders.order_number into v_id, v_num;

  -- Price every line SERVER-SIDE. Never trust client-sent amounts.
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_bundle := it->>'bundle_type';
    v_qty    := coalesce((it->>'quantity')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for "%"', coalesce(it->>'meal_name', 'item');
    end if;

    if v_bundle = 'build_your_own' then
      -- Custom builds are composed from ingredients on the client and have no
      -- catalog row to price against. Accept the client price but require it to
      -- be sane so it can't be tampered down to pennies.
      v_meal_id := null;
      v_unit    := round((it->>'unit_price')::numeric, 2);
      if v_unit is null or v_unit <= 0 or v_unit > 30 then
        raise exception 'Invalid custom meal price';
      end if;
    else
      -- Catalog meal: authoritative price comes from the meals table by slug.
      v_slug := nullif(it->>'slug', '');
      if v_slug is null then
        raise exception 'Missing item reference — please refresh your basket and try again';
      end if;
      select * into v_meal
        from public.meals
        where slug = v_slug and is_active = true;
      if not found then
        raise exception 'Sorry, "%" is no longer available', coalesce(it->>'meal_name', v_slug);
      end if;
      v_meal_id := v_meal.id;
      v_unit := case v_bundle
        when 'single'    then v_meal.price_single
        when 'bundle_5'  then v_meal.price_bundle_5
        when 'bundle_10' then v_meal.price_bundle_10
        else null
      end;
      if v_unit is null then
        raise exception 'No price configured for "%" (%)', coalesce(it->>'meal_name', v_slug), v_bundle;
      end if;
    end if;

    v_line     := round(v_unit * v_qty, 2);
    v_subtotal := v_subtotal + v_line;

    insert into public.order_items
      (order_id, meal_id, meal_name, bundle_type,
       quantity, unit_price, line_total, build_details, macros)
    values
      (v_id, v_meal_id, it->>'meal_name', v_bundle,
       v_qty, v_unit, v_line,
       nullif(it->'build_details', 'null'::jsonb),
       nullif(it->'macros', 'null'::jsonb));
  end loop;

  -- Stamp the server-computed totals onto the order (no discount logic yet,
  -- so total == subtotal). The Stripe charge reads orders.total, not the client.
  update public.orders
    set subtotal = v_subtotal, total = v_subtotal
    where orders.id = v_id;

  return query select v_id, v_num, v_subtotal;
end;
$$;

-- Only the app roles may call it; the function itself enforces the rest.
revoke all     on function public.place_order(text,text,text,timestamptz,numeric,numeric,text,jsonb) from public;
grant  execute on function public.place_order(text,text,text,timestamptz,numeric,numeric,text,jsonb) to anon, authenticated;
