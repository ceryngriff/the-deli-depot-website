-- =========================================================
-- Migration 06: Lock down order creation (SECURITY FIX)
-- Run this in the Supabase SQL Editor.
--
-- THE PROBLEM
-- The orders/order_items "owner_insert" RLS policies allowed a row to be
-- created DIRECTLY via the public (anon) API, with a client-chosen `total`.
-- Because create-payment-intent charges orders.total, someone calling the
-- REST API directly (bypassing the website) could insert a £50 order priced
-- at £0.01 and pay almost nothing.
--
-- THE FIX
-- Remove the direct INSERT policies. All order creation already goes through
-- public.place_order(), a SECURITY DEFINER function that prices every line
-- server-side from the meals table and ignores client totals. It runs as the
-- table owner, so it is unaffected by RLS — legitimate checkout keeps working
-- for guests and logged-in customers. We keep the owner SELECT policies (so
-- customers can still see their own orders) and the admin policies.
--
-- Safe to re-run.
-- =========================================================

drop policy if exists "orders_owner_insert" on public.orders;
drop policy if exists "items_owner_insert"  on public.order_items;

-- Belt-and-braces: make sure the public role can't insert directly even if a
-- permissive policy is ever re-added. (place_order is SECURITY DEFINER, so it
-- still works; anon/authenticated only need EXECUTE on it, granted already.)
revoke insert on public.orders      from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;

-- =========================================================
-- DONE. Verify after running:
--   • Place a normal order on the website — should still work.
--   • A direct PostgREST insert into orders with the anon key should now FAIL.
-- =========================================================
