-- =========================================================
-- Migration 02: Allergen profile on customers
-- Run this in the Supabase SQL Editor.
-- Safe to re-run.
-- =========================================================

-- Customer's declared allergens — used by the site to warn them
-- about meals they shouldn't eat. Always-on, like Natasha's Law
-- but customer-side rather than shop-side.
alter table public.profiles
  add column if not exists allergens text[] not null default '{}';

-- Done. The site reads this column on the customer's account page
-- and via meal.html / basket.html to render allergen warnings.
