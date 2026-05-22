# Supabase Setup — The Deli Depot

This folder holds the database schema for the meal-prep ordering system. Follow these steps once, in order, to get the backend running. You'll only need to do this once per Supabase project.

If you've never used Supabase before, don't worry — it's basically a hosted Postgres database with a friendly dashboard, plus built-in user authentication. You won't need to install anything locally.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is plenty for now).
2. Click **New project**.
3. Pick an organisation (or create one called "The Deli Depot").
4. Project settings:
   - **Name:** `the-deli-depot`
   - **Database password:** generate a strong one and save it in your password manager. You won't need it day-to-day, but you'll need it if you ever restore a backup.
   - **Region:** choose **West EU (London)** — closest to Merthyr.
   - **Pricing plan:** Free.
5. Click **Create new project** and wait ~2 minutes while it spins up.

---

## 2. Run the schema

This creates all the tables, security rules, and seeds 6 sample meals.

1. In the left sidebar of your Supabase project, click **SQL Editor**.
2. Click **+ New query**.
3. Open the file [`schema.sql`](schema.sql) in this folder, copy the entire contents, and paste it into the SQL editor.
4. Click **Run** (or press `Ctrl + Enter`).
5. You should see "Success. No rows returned." at the bottom. Any red error needs investigating — copy it and ask Claude.

To double-check it worked, click **Table Editor** in the sidebar. You should see 6 tables: `profiles`, `meals`, `orders`, `order_items`, `subscriptions`, `audit_log`. Click `meals` and you should see 6 starter meals.

> **The schema file is safe to re-run.** It drops and recreates policies, and uses `on conflict do nothing` for seed data, so running it twice won't break anything or duplicate meals.

---

## 3. Grab your project URL and anon key

The site needs these two values to talk to Supabase.

1. In the sidebar, click **Project Settings** (the gear icon at the bottom).
2. Click **API**.
3. Copy these two values:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon / public key** — a long string starting with `eyJhbGci...`

**Note on safety:** the `anon` key is fine to put in your website's JavaScript — that's what it's designed for. Row Level Security (which the schema sets up) is what protects your data. The `service_role` key on the same page, however, is **never** to be put in client code; treat it like an admin password.

You'll plug these values into the site in Phase 2 (next step). Keep them safe for now.

---

## 4. Create your admin account

Once Phase 2 (auth foundation) is built, you'll be able to:

1. Visit `login.html` on the deployed site and sign up with your email.
2. Open Supabase → **SQL Editor** → new query, and run:
   ```sql
   update public.profiles
     set role = 'admin'
     where email = 'a1ceryn@aol.com';
   ```
   (Replace with whatever email you signed up with.)
3. Verify by running:
   ```sql
   select id, email, role from public.profiles;
   ```
   Your row should show `role = admin`.

That's it — you're the admin. There's no second step; the admin dashboard checks this `role` field on every page load.

---

## 5. (Optional) Enable Google sign-in

If you want customers to be able to sign in with Google as well as email:

1. In Supabase, go to **Authentication → Providers**.
2. Find **Google** and toggle it on.
3. You'll need a Google OAuth client. Follow Supabase's prompts — it walks you through the Google Cloud Console steps. Roughly:
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project (one-off, free)
   - Enable the **Google+ API**
   - Create **OAuth 2.0 credentials**
   - Set the authorised redirect URI to the value Supabase shows you (something like `https://abcdefghij.supabase.co/auth/v1/callback`)
   - Copy the Client ID and Client Secret back into Supabase
4. Save.

You can skip this entirely for launch — email + password and magic links will work without it.

---

## 6. (Reference) Storage bucket

The schema also creates a Storage bucket called `meal-images` which the admin dashboard uses to upload photos of meals. You don't need to do anything — it's all set up.

If you want to confirm it exists: click **Storage** in the sidebar, you should see `meal-images` listed as a Public bucket.

---

## Common things you might want to do

### See all customers
```sql
select id, email, full_name, phone, role, created_at
from public.profiles
order by created_at desc;
```

### See today's orders
```sql
select order_number, customer_name, status, collection_slot, total
from public.orders
where collection_slot::date = current_date
order by collection_slot;
```

### Reset a customer back to non-admin (revoke admin)
```sql
update public.profiles set role = 'customer' where email = 'someone@example.com';
```

### Wipe the meals table and start fresh
```sql
delete from public.meals;
```
(Once you do this, add meals via the admin dashboard rather than re-running the schema.)

### Take a backup
Supabase auto-backs up paid plans daily. On the free plan, click **Database → Backups** in the sidebar and you can trigger a manual backup or download a SQL dump. Worth doing before any big change.

---

## Troubleshooting

**"permission denied for table X"**
Row Level Security is working. Either you're not logged in, or you're trying to read someone else's data, or you're not an admin yet. Check `select auth.uid()` shows your user id, and `select role from profiles where id = auth.uid()` shows `admin`.

**"new row violates row-level security policy"**
Usually means you're trying to write data that doesn't belong to your user. For example, creating an order with someone else's `customer_id`. The site code should never do this — if you see it, it's a bug in the site.

**Schema run hangs or errors**
Try running smaller chunks. The schema file is organised into numbered sections — you can run section by section if needed.

**I forgot which email I signed up with**
In Supabase, **Authentication → Users** shows everyone who's signed up. Find yourself there.

---

## What's next

Once you've finished steps 1–3 above, you're done with Phase 1. Tell Claude to start Phase 2a (auth foundation), and provide it with the Project URL + anon key when prompted.
