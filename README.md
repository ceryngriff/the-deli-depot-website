# The Deli Depot — Website

Customer site + meal-prep ordering + admin dashboard for The Deli Depot, Unit 5, Pant Industrial Estate, Merthyr Tydfil.

Plain HTML/CSS/JS — no build step. Supabase handles auth, database, and image storage.

---

## What you can do

**As a customer (after signing up):**
- Browse the weekly meal-prep menu, filter by macros / protein / goal
- Build your own meal (4-step protein → carb → veg → sauce wizard with live macros)
- Add to basket, check out, pick a collection slot
- Subscribe to Set & Forget / Surprise Me / Custom weekly plans (10% off)
- See your orders, manage subscriptions, edit your profile

**As an admin (Ceryn):**
- Manage meals (add, edit, toggle active, upload images, bulk-rotate "new this week")
- See and update orders (filter by status, mark Preparing / Ready / Collected, add internal notes)
- Manage customer subscriptions (pause / resume / cancel, change collection slot)
- Read reports (revenue chart, top 10 meals, customer breakdown, CSV export)

---

## File layout

```
the-deli-depot-website/
├── index.html                  ← homepage (deli + meal-prep promo)
├── menu.html                   ← weekly meal-prep grid
├── meal.html                   ← single meal page (?slug=…)
├── build-your-own.html         ← custom meal builder
├── basket.html                 ← cart review
├── checkout.html               ← order placement
├── order-confirmation.html     ← post-checkout receipt
├── account.html                ← customer dashboard (orders / subs / profile)
├── login.html                  ← customer sign in / sign up
├── subscriptions.html          ← browse plans + 5-step signup wizard
│
├── admin/                      ← staff area (gated by role='admin')
│   ├── index.html              ← dashboard with metrics + today's collections
│   ├── menu.html               ← meal CRUD + image upload
│   ├── orders.html             ← orders table + detail / status updates
│   ├── subscriptions.html      ← subscriptions table + detail / pause / cancel
│   ├── reports.html            ← Chart.js reports + CSV export
│   └── login.html              ← staff sign-in
│
├── supabase/
│   ├── schema.sql              ← full DB schema + RLS + seed data
│   └── README.md               ← step-by-step Supabase setup guide
│
├── css/
│   ├── style.css               ← brand styles
│   ├── meal-prep.css           ← customer-facing pages
│   ├── auth.css                ← login / sign-up forms
│   ├── checkout.css            ← basket / checkout / confirmation
│   ├── account.css             ← account page + toast notifications
│   ├── subscriptions.css       ← subscriptions cards + wizard
│   └── admin.css               ← admin dashboard / sidebar / tables / modals
│
├── js/
│   ├── env.example.js          ← template for js/env.js (gitignored)
│   ├── env.js                  ← your Supabase URL + anon key (gitignored)
│   ├── supabase.js             ← shared Supabase client
│   ├── auth.js                 ← sign-in/out + route guards
│   ├── nav.js                  ← live auth state on the nav button
│   ├── basket.js               ← localStorage basket
│   ├── toast.js                ← notifications helper
│   ├── main.js                 ← homepage scroll / filters / contact form
│   ├── menu.js                 ← weekly menu grid (reads from Supabase)
│   ├── meal.js                 ← single meal page
│   ├── builder.js              ← build-your-own
│   ├── basket-page.js          ← basket.html controller
│   ├── checkout.js             ← checkout.html controller (places orders)
│   ├── order-confirmation.js   ← confirmation page
│   ├── account.js              ← customer account dashboard
│   ├── subscriptions.js        ← subscriptions wizard
│   ├── login.js                ← login.html controller
│   └── admin-*.js              ← one per admin page
│
├── data/menu.json              ← in-store deli menu (unchanged)
├── assets/                     ← images
├── netlify.toml                ← Netlify config (headers, redirects, caching)
├── robots.txt                  ← blocks /admin/ from search
└── sitemap.xml                 ← customer pages only
```

---

## First-time setup

### 1. Set up Supabase

Follow [`supabase/README.md`](supabase/README.md) step by step. It walks you through:
1. Creating a free Supabase project
2. Running [`supabase/schema.sql`](supabase/schema.sql) to create all the tables, security rules, and 6 starter meals
3. Grabbing your Project URL + publishable (anon) key
4. Promoting your account to admin

### 2. Plug the keys in

**Locally:** open [`js/env.js`](js/env.js) and paste your values:

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdefghij.supabase.co',
  anonKey: 'sb_publishable_...'        // OR an `eyJ...` anon key (older format)
};
```

This file is gitignored so your local keys never get pushed.

**On Netlify (for the deployed site):** add a snippet injection that writes the same config inline. Full instructions in [`supabase/README.md` § 3](supabase/README.md).

### 3. Run locally

The site needs to be served via HTTP (not opened as `file:///…`) because it uses ES modules.

```bash
python -m http.server 8000
```

Or `npx serve .` if you have Node.

Then open <http://localhost:8000>.

---

## Day-to-day: managing the menu

Almost everything happens in the **admin dashboard** at <https://thedelidepot.co.uk/admin/> (or `localhost:8000/admin/` during dev).

- **Add a meal** → Menu → "+ New Meal" → fill in slug, name, prices, macros, upload an image. Save.
- **Hide a meal from the customer menu** → toggle the Active switch off in the row.
- **Rotate "New this week"** → use the bulk "Clear all" button on a Sunday, then toggle on for whatever's new.
- **Take an order off the floor** → Orders → click View → set status to Preparing → Ready → Collected. Customer's account view updates in real time.
- **Pause a customer's subscription** → Subscriptions → click View → Pause Subscription with a date.

Anything you change in the admin section is logged in the `audit_log` table — you can always see who did what and when by running `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50` in the Supabase SQL editor.

### Editing the in-store deli menu

The in-store deli menu (sandwiches, salad bar, hot food, etc. on the homepage) is still loaded from a JSON file: [`data/menu.json`](data/menu.json). It's separate from the meal-prep menu, which is in Supabase.

To update it, edit the JSON and push. Each item is:

```json
{
  "category": "sandwiches",
  "name": "The Depot Classic",
  "description": "Fresh ham, mature cheddar, …",
  "tag": "Signature",
  "image": "assets/images/the-depot-classic.png"
}
```

Categories must be one of: `sandwiches`, `salad-bar`, `hot-food`, `deli-counter`, `drinks`, `sweet-treats`, `pots`.

---

## Deploying

### Netlify (what this repo is set up for)

1. Push to GitHub.
2. Sign up at [netlify.com](https://www.netlify.com) and connect your GitHub repo.
3. Build settings — leave everything as defaults (no build command, publish directory `.`). The repo's `netlify.toml` already configures caching, headers, and the `/admin → /admin/index.html` redirect.
4. Add the Supabase snippet injection (see [`supabase/README.md` § 3](supabase/README.md)).
5. Trigger a deploy → Site is live.

Every subsequent `git push` deploys automatically within ~30 seconds.

---

## Customising

### Contact details

In [`index.html`](index.html) search and replace:

| Placeholder                  | Replace with               |
| ---------------------------- | -------------------------- |
| `TBC (add phone number)`     | real phone number          |
| `+44-000-000-0000`           | real phone in schema block |
| `hello@thedelidepot.co.uk`   | real email                 |

Social links: replace the bare `facebook.com/`, `tiktok.com/`, `instagram.com/` URLs in the footer.

### Brand palette / fonts

All variables are in [`css/style.css`](css/style.css) at the top:

```css
:root {
  --bg:          #1a1a1a;
  --gold:        #c9a961;
  --cream:       #f5f1e8;
  --serif:       'Great Vibes', cursive;
  --sans:        'Montserrat', sans-serif;
  …
}
```

Change once → everything updates.

### Collection time slots

Edit `TIME_SLOTS` in [`js/checkout.js`](js/checkout.js) (customer order checkout), [`js/subscriptions.js`](js/subscriptions.js) (sub signup wizard), and [`js/admin-subscriptions.js`](js/admin-subscriptions.js) (admin slot changes — keep all three in sync). Defaults are 8 AM / 12 PM / 5 PM.

---

## Things intentionally left for later

These are wired up enough to launch, with clear `TODO` comments where they'll plug in:

- **Stripe payments** — `js/checkout.js` creates orders with `payment_status = 'unpaid'`. Payment is taken in person on collection. When Stripe goes in, add the Payment Element between order creation and confirmation.
- **Twilio SMS** — `js/admin-orders.js` "Send Collection-Ready SMS" button is currently a placeholder that toasts the phone number so you can text manually. Wire up to a serverless function (Netlify or Supabase Edge) when ready.
- **Customer-deletion edge function** — `js/account.js` "Delete My Account" signs the user out and asks them to email to finish deletion. A proper edge function with the service-role key could delete `auth.users` automatically.
- **Subscription → orders link** — admin/subscriptions.html shows the customer's recent orders rather than orders generated *by* a subscription. Adding `orders.subscription_id` + a weekly "generate orders" job would close that loop.

---

## Tech notes

- **No build step.** Vanilla HTML / CSS / ES modules. Anyone can maintain it without npm.
- **Auth:** Supabase email + password + magic link + Google OAuth. Sessions persist in localStorage.
- **Security:** Row Level Security on every table — customers can only see their own data, admins can do anything, anonymous users can only read active meals.
- **Storage:** images uploaded via the admin go to the public `meal-images` Supabase bucket.
- **Audit trail:** every admin write goes to `public.audit_log` with `before`/`after` JSON.
- **Performance:** lazy-loaded images, immutable cache headers on static assets, no third-party JS except Supabase + Chart.js (admin reports only).
- **Accessibility:** semantic HTML, skip link, focus rings, ARIA on every interactive element, `prefers-reduced-motion` honoured.
- **Mobile-first:** from 320px upwards; sidebar collapses to a drawer on the admin pages.

---

## Help

- Supabase issue? → check [`supabase/README.md`](supabase/README.md) troubleshooting section
- Site not loading the menu? → make sure you're using a local server (`python -m http.server`), not opening `index.html` directly
- Customer reports they can't see their order on the confirmation page? → guest orders aren't visible after the first page-load because of RLS. They need to use the order number we email/text them. (Email sending isn't wired up yet — see "Things left for later" above.)
- For anything else: `git log` shows what changed and when, and the commit messages explain why.
