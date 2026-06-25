# ✅ The Deli Depot — TODO

Master list of outstanding setup/admin tasks. Tick off as you go.

---

## 🔴 SECURITY — run before taking real payments
A direct-API order-pricing hole was found and fixed in code. The fix is a
database change you must apply (Claude can't reach the live DB).
- [ ] Run **`supabase/migrations/06-secure-order-creation.sql`** in the Supabase
      SQL Editor (Meal prep project). It stops anyone creating an order at a
      price they choose. Order creation keeps working via the secure
      `place_order` function. Verify a normal order still goes through after.

(The HSTS security header was added in `netlify.toml` and deploys automatically.)

---

## 💳 Stripe payments — take real money
The payment **code is already built and secure**. This is config only (keys +
webhook), no coding. You can do all the TEST steps before finishing account
activation; LIVE needs activation done.

**The 4 pieces:** publishable key (`pk_…`) → `js/env.js` · secret key (`sk_…`/`rk_…`)
→ Netlify env var `STRIPE_SECRET_KEY` · webhook secret (`whsec_…`) → Netlify env var
`STRIPE_WEBHOOK_SECRET` · Supabase URL + service_role key → Netlify env vars.
🔒 Secret/service-role keys go ONLY in Netlify, never in the website files.

### Step 1 — Netlify env vars (Site configuration → Environment variables)
- [ ] `STRIPE_SECRET_KEY` = Stripe → Developers → API keys → Secret key (test `sk_test_…` first)
- [ ] `STRIPE_WEBHOOK_SECRET` = from Step 2 (`whsec_…`)
- [ ] `SUPABASE_URL` = `https://wcfvnlntkhpnokrejljl.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Supabase (Meal prep) → Project Settings → API → service_role secret

### Step 2 — Webhook (Stripe → Developers → Webhooks → Add endpoint)
- [ ] URL: `https://thedelidepot.com/.netlify/functions/stripe-webhook`
- [ ] Events: `payment_intent.succeeded` + `payment_intent.payment_failed`
- [ ] Copy signing secret (`whsec_…`) → into `STRIPE_WEBHOOK_SECRET`

### Step 3 — Test (fake money)
- [ ] Place an order, pay with test card **4242 4242 4242 4242** (any future expiry/CVC/postcode)
- [ ] Admin → Orders shows it **paid / confirmed**, and it appears in the Stripe test dashboard

### Step 4 — Go live (real money)
- [ ] Finish Stripe account activation (business details + bank for payouts)
- [ ] Switch Stripe to Live mode, get live keys
- [ ] Netlify `STRIPE_SECRET_KEY` → `sk_live_…` (or live `rk_…`)
- [ ] Re-create the webhook in **Live mode** → update `STRIPE_WEBHOOK_SECRET` with its live `whsec_…`
- [ ] Live publishable key (`pk_live_…`) → paste to Claude to update `js/env.js` + deploy
- [ ] One small real order with your own card, then refund it

---

## 🌿 Allergens — verify before relying on the labels
Build Your Own currently declares "may contain ALL 14 allergens" as a safe
blanket. After your stock purge + delivery, set the real per-ingredient
allergens and tighten the blanket.
- [ ] See **[ALLERGEN-TODO.md](ALLERGEN-TODO.md)** for the full step-by-step.

---

## 🍽 Build Your Own — confirm kitchen portions
The plating amounts shown to staff (rice 180g, veg 80g, sauces 30ml, etc.) are
sensible defaults, not your real recipes.
- [ ] Check/adjust the `amount:` values in `js/builder-data.js` to match what
      the kitchen actually serves (also keeps the calorie counts honest).
