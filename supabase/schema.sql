-- =========================================================
-- THE DELI DEPOT — DATABASE SCHEMA
-- Run this in the Supabase SQL Editor (SQL > New query).
-- Safe to re-run: drops and recreates everything cleanly.
-- =========================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()


-- =========================================================
-- 1. PROFILES (extends auth.users)
-- =========================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        text not null default 'customer' check (role in ('customer','admin')),
  notes       text,
  allergens   text[] not null default '{}',  -- customer-declared dietary allergens
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Helper: is the current user an admin?
-- SECURITY DEFINER + search_path lock so it can read profiles
-- without tripping RLS recursion when used in policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;


-- =========================================================
-- 2. MEALS
-- =========================================================
create table if not exists public.meals (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  tagline               text,
  category              text not null default 'signature'
                          check (category in ('signature','breakfast','add-on')),
  description           text,
  image_url             text,
  kcal                  int,
  protein_g             int,
  carbs_g               int,
  fat_g                 int,
  price_single          numeric(6,2),
  price_bundle_5        numeric(6,2),
  price_bundle_10       numeric(6,2),
  tags                  text[] default '{}',
  protein_source        text,
  goal_tags             text[] default '{}',
  ingredients           text,
  allergens_contains    text[] default '{}',
  allergens_may_contain text[] default '{}',
  heat_instructions     text,
  storage               text,
  is_active             boolean not null default true,
  new_this_week         boolean not null default false,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists meals_is_active_sort_idx
  on public.meals (is_active, sort_order);


-- =========================================================
-- 3. ORDERS
-- =========================================================
create sequence if not exists public.order_number_seq start 1;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,
  customer_id     uuid references public.profiles(id) on delete set null,
  customer_email  text,
  customer_name   text,
  customer_phone  text,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','preparing','ready','collected','cancelled')),
  collection_slot timestamptz,
  subtotal        numeric(8,2) not null default 0,
  total           numeric(8,2) not null default 0,
  notes           text,
  admin_notes     text,
  payment_status  text not null default 'unpaid'
                    check (payment_status in ('unpaid','paid','refunded')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_customer_idx       on public.orders (customer_id);
create index if not exists orders_status_idx         on public.orders (status);
create index if not exists orders_collection_slot_idx on public.orders (collection_slot);

-- Generate order_number like DD-2026-0001 (sequence never resets, lots of room).
create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number :=
      'DD-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_number_trigger on public.orders;
create trigger set_order_number_trigger
  before insert on public.orders
  for each row execute function public.set_order_number();


-- =========================================================
-- 4. ORDER ITEMS
-- =========================================================
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  meal_id       uuid references public.meals(id) on delete set null,
  meal_name     text not null,
  bundle_type   text not null
                  check (bundle_type in ('single','bundle_5','bundle_10','build_your_own')),
  quantity      int not null default 1 check (quantity > 0),
  unit_price    numeric(6,2) not null,
  line_total    numeric(8,2) not null,
  build_details jsonb,
  macros        jsonb
);

create index if not exists order_items_order_idx on public.order_items (order_id);


-- =========================================================
-- 5. SUBSCRIPTIONS
-- =========================================================
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles(id) on delete cascade,
  plan_type         text not null
                      check (plan_type in ('set_and_forget','surprise_me','custom')),
  meals_per_week    int not null check (meals_per_week between 1 and 14),
  selected_meal_ids uuid[] default '{}',
  collection_day    text check (collection_day in
                      ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  collection_time   text,
  status            text not null default 'active'
                      check (status in ('active','paused','cancelled')),
  discount_percent  int not null default 10,
  paused_until      date,
  next_renewal      date,
  created_at        timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on public.subscriptions (customer_id);
create index if not exists subscriptions_status_idx   on public.subscriptions (status);


-- =========================================================
-- 6. AUDIT LOG
-- =========================================================
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);


-- =========================================================
-- 7. SLOT CAPACITIES
-- One row per (weekday, time-of-day) slot, with a configurable cap.
-- Rows with no entry are treated as "no cap".
-- =========================================================
create table if not exists public.slot_capacities (
  id          uuid primary key default gen_random_uuid(),
  weekday     text not null check (weekday in
                ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  time_slot   text not null,
  max_orders  int  not null default 20 check (max_orders >= 0),
  created_at  timestamptz not null default now(),
  unique (weekday, time_slot)
);

-- RPC consumed by checkout to render time-slot availability without
-- exposing other order details. SECURITY DEFINER so it bypasses RLS.
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
  select c.time_slot, coalesce(u.cnt, 0) as used, c.max_orders
  from caps c
  left join used u on u.time_slot = c.time_slot
  order by c.time_slot;
$$;

grant execute on function public.slot_availability(date) to anon, authenticated;


-- =========================================================
-- updated_at trigger (shared by meals + orders)
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meals_touch_updated on public.meals;
create trigger meals_touch_updated
  before update on public.meals
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated on public.orders;
create trigger orders_touch_updated
  before update on public.orders
  for each row execute function public.touch_updated_at();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles        enable row level security;
alter table public.meals           enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.audit_log       enable row level security;
alter table public.slot_capacities enable row level security;

-- Drop any previous versions so this file can be re-run cleanly.
drop policy if exists "profiles_self_read"     on public.profiles;
drop policy if exists "profiles_self_update"   on public.profiles;
drop policy if exists "profiles_admin_all"     on public.profiles;
drop policy if exists "meals_public_read"      on public.meals;
drop policy if exists "meals_admin_all"        on public.meals;
drop policy if exists "orders_owner_read"      on public.orders;
drop policy if exists "orders_owner_insert"    on public.orders;
drop policy if exists "orders_admin_all"       on public.orders;
drop policy if exists "items_owner_read"       on public.order_items;
drop policy if exists "items_owner_insert"     on public.order_items;
drop policy if exists "items_admin_all"        on public.order_items;
drop policy if exists "subs_owner_read"        on public.subscriptions;
drop policy if exists "subs_owner_insert"      on public.subscriptions;
drop policy if exists "subs_owner_update"      on public.subscriptions;
drop policy if exists "subs_admin_all"         on public.subscriptions;
drop policy if exists "audit_admin_read"       on public.audit_log;
drop policy if exists "audit_admin_insert"     on public.audit_log;

-- -------- profiles --------
create policy "profiles_self_read"   on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- customers cannot self-promote: role must stay 'customer' unless admin updates them
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_all"   on public.profiles
  for all using (public.is_admin())
  with check (public.is_admin());

-- -------- meals --------
create policy "meals_public_read"    on public.meals
  for select using (is_active = true or public.is_admin());

create policy "meals_admin_all"      on public.meals
  for all using (public.is_admin())
  with check (public.is_admin());

-- -------- orders --------
create policy "orders_owner_read"    on public.orders
  for select using (customer_id = auth.uid());

create policy "orders_owner_insert"  on public.orders
  for insert with check (
    customer_id = auth.uid() or customer_id is null  -- guest checkout
  );

create policy "orders_admin_all"     on public.orders
  for all using (public.is_admin())
  with check (public.is_admin());

-- -------- order_items --------
create policy "items_owner_read"     on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = auth.uid()
    )
  );

create policy "items_owner_insert"   on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or o.customer_id is null)
    )
  );

create policy "items_admin_all"      on public.order_items
  for all using (public.is_admin())
  with check (public.is_admin());

-- -------- subscriptions --------
create policy "subs_owner_read"      on public.subscriptions
  for select using (customer_id = auth.uid());

create policy "subs_owner_insert"    on public.subscriptions
  for insert with check (
    customer_id = auth.uid() and discount_percent = 10
  );

create policy "subs_owner_update"    on public.subscriptions
  for update using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    -- customers can pause/resume/cancel and change their meal selection
    -- but they cannot change the discount
    and discount_percent = (
      select discount_percent from public.subscriptions s where s.id = subscriptions.id
    )
  );

create policy "subs_admin_all"       on public.subscriptions
  for all using (public.is_admin())
  with check (public.is_admin());

-- -------- audit_log --------
-- Admins can read everything. No client-side inserts: in Phase 3 the admin app
-- writes audit entries via the standard auth context, so we allow admin INSERT.
create policy "audit_admin_read"   on public.audit_log
  for select using (public.is_admin());

create policy "audit_admin_insert" on public.audit_log
  for insert with check (public.is_admin());

-- -------- slot_capacities --------
drop policy if exists "slot_caps_public_read" on public.slot_capacities;
create policy "slot_caps_public_read"
  on public.slot_capacities
  for select using (true);

drop policy if exists "slot_caps_admin_all" on public.slot_capacities;
create policy "slot_caps_admin_all"
  on public.slot_capacities
  for all using (public.is_admin())
  with check (public.is_admin());

-- Seed default cap of 20 per slot.
insert into public.slot_capacities (weekday, time_slot, max_orders)
select w, t, 20
from (values ('monday'),('tuesday'),('wednesday'),('thursday'),('friday'),('saturday'))
       as wd(w)
cross join (values ('08:00'),('12:00'),('17:00'),('19:00')) as ts(t)
on conflict (weekday, time_slot) do nothing;


-- =========================================================
-- STORAGE BUCKET FOR MEAL IMAGES
-- =========================================================
-- Public read so customer pages can show images via the URL.
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "meal_images_public_read"  on storage.objects;
drop policy if exists "meal_images_admin_write"  on storage.objects;
drop policy if exists "meal_images_admin_update" on storage.objects;
drop policy if exists "meal_images_admin_delete" on storage.objects;

create policy "meal_images_public_read"
  on storage.objects for select
  using (bucket_id = 'meal-images');

create policy "meal_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'meal-images' and public.is_admin());

create policy "meal_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'meal-images' and public.is_admin());

create policy "meal_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'meal-images' and public.is_admin());


-- =========================================================
-- SEED DATA — 6 starter meals
-- These mirror data/meal-prep-menu.json and can be deleted/edited
-- once you've added your real meals from the admin dashboard.
-- =========================================================
insert into public.meals
  (slug, name, tagline, category, description, image_url,
   kcal, protein_g, carbs_g, fat_g,
   price_single, price_bundle_5, price_bundle_10,
   tags, protein_source, goal_tags,
   ingredients, allergens_contains, allergens_may_contain,
   heat_instructions, storage,
   is_active, new_this_week, sort_order)
values
  ('powerhouse',
   'The Powerhouse',
   'Piri Piri Chicken · Basmati · Tenderstem',
   'signature',
   'Marinated grilled chicken breast over fluffy basmati rice, finished with charred tenderstem broccoli and roasted peppers. Smoky, lean and built to fuel a heavy training session.',
   'assets/meals/powerhouse.jpg',
   485, 52, 38, 12,
   7.50, 33.50, 64.00,
   array['high-protein','gluten-free','lean'],
   'chicken',
   array['lean','maintenance'],
   'Chicken breast, basmati rice, tenderstem broccoli, red peppers, olive oil, piri piri spice blend (paprika, garlic, chilli, lemon), sea salt, black pepper.',
   array['mustard'],
   array['gluten','dairy','eggs','nuts'],
   'Microwave on full power for 90 seconds. Stir, leave to rest 30 seconds, serve. Oven: 180°C for 12 minutes covered.',
   'Keep refrigerated below 5°C. Best within 4 days of collection. Suitable for home freezing.',
   true, true, 10),

  ('beef-spud',
   'Beef & Sweet Spud',
   'Slow-braised beef, sweet potato, kale',
   'signature',
   'Tender braised beef chuck steak with roasted sweet potato wedges, massaged kale and a rich beefy jus. Perfect for bulking season or weekend energy.',
   'assets/meals/beef-spud.jpg',
   620, 48, 58, 18,
   8.00, 36.00, 68.00,
   array['high-protein','bulk'],
   'beef',
   array['bulk','maintenance'],
   'Beef chuck steak, sweet potato, kale, beef stock, red onion, garlic, thyme, rosemary, olive oil, sea salt, black pepper.',
   array[]::text[],
   array['celery','gluten'],
   'Microwave on full power for 2 minutes. Stir well. Oven: 160°C for 15 minutes covered.',
   'Keep refrigerated below 5°C. Best within 3 days of collection. Suitable for home freezing.',
   true, false, 20),

  ('honey-salmon',
   'Honey Glazed Salmon',
   'Salmon, jasmine rice, edamame slaw',
   'signature',
   'Pan-seared salmon fillet with a light honey and soy glaze, served on fluffy jasmine rice with a crisp edamame and sesame slaw. Omega-3 packed and restaurant quality.',
   'assets/meals/honey-salmon.jpg',
   540, 42, 44, 16,
   9.00, 40.50, 77.00,
   array['high-protein','omega-3','lean'],
   'salmon',
   array['lean','maintenance'],
   'Salmon fillet, jasmine rice, edamame, cucumber, sesame seeds, rice vinegar, soy sauce, honey, ginger, garlic, sesame oil, sea salt.',
   array['soy','sesame','fish'],
   array['gluten','nuts'],
   'Microwave on full power for 90 seconds. Stir gently. Oven: 160°C for 10 minutes covered.',
   'Keep refrigerated below 5°C. Best within 2 days of collection. Not suitable for freezing.',
   true, false, 30),

  ('halloumi-couscous',
   'Halloumi & Couscous',
   'Griddled halloumi, lemon couscous, med veg',
   'signature',
   'Squeaky-fresh halloumi cheese griddled until golden, with fluffy lemon couscous and a medley of roasted Mediterranean vegetables. Vegetarian crowd-pleaser.',
   'assets/meals/halloumi-couscous.jpg',
   510, 26, 48, 22,
   7.00, 31.50, 60.00,
   array['vegetarian','mediterranean'],
   'plant-based',
   array['lean','maintenance'],
   'Halloumi cheese, couscous, zucchini, eggplant, red pepper, red onion, cherry tomato, olive oil, lemon juice, garlic, oregano, sea salt, black pepper.',
   array['dairy'],
   array['gluten','sulfites'],
   'Microwave on full power for 75 seconds. Stir. Oven: 180°C for 10 minutes covered.',
   'Keep refrigerated below 5°C. Best within 4 days of collection. Suitable for home freezing.',
   true, true, 40),

  ('tikka-chicken',
   'Tikka Chicken Bowl',
   'Tandoori chicken, cauli rice, raita',
   'signature',
   'Spiced tandoori chicken thighs with cauliflower rice, cooling natural yogurt raita and toasted cumin seeds. Low-carb, high-protein, and deeply aromatic.',
   'assets/meals/tikka-chicken.jpg',
   395, 46, 14, 15,
   7.50, 33.50, 64.00,
   array['high-protein','low-carb','under-500-kcal','gluten-free'],
   'chicken',
   array['lean','maintenance'],
   'Chicken thighs, cauliflower, Greek yogurt, ginger, garlic, tandoori spice blend, lemon juice, coriander, cumin seeds, sea salt, black pepper.',
   array['dairy'],
   array['nuts','sesame'],
   'Microwave on full power for 90 seconds. Stir well. Oven: 180°C for 12 minutes covered.',
   'Keep refrigerated below 5°C. Best within 4 days of collection. Suitable for home freezing.',
   true, false, 50),

  ('banana-oats',
   'Banana Protein Oats',
   'Overnight oats, whey, banana, almond butter',
   'breakfast',
   'Creamy overnight oats blended with whey protein powder, topped with sliced banana, almond butter, granola crunch and a drizzle of honey. Grab-and-go breakfast fuel.',
   'assets/meals/banana-oats.jpg',
   420, 32, 52, 10,
   4.50, 20.00, 38.00,
   array['breakfast','high-protein','vegetarian','under-500-kcal'],
   'plant-based',
   array['maintenance'],
   'Rolled oats, whole milk, whey protein powder (vanilla), banana, natural almond butter, honey, granola (oats, honey, coconut oil), sea salt.',
   array['dairy','nuts'],
   array['gluten','sesame','soy'],
   'Enjoy cold straight from the fridge, or warm gently in microwave for 60 seconds if preferred.',
   'Keep refrigerated below 5°C. Best within 2 days of collection. Not suitable for home freezing.',
   true, false, 60)
on conflict (slug) do nothing;


-- =========================================================
-- DONE
-- After this finishes successfully:
--   1. Sign up via the website (or the Supabase Auth dashboard).
--   2. Promote yourself to admin by running:
--        update public.profiles set role = 'admin' where email = 'YOUR-EMAIL';
--   3. Verify: select id, email, role from public.profiles;
-- =========================================================
