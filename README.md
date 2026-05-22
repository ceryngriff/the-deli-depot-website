# The Deli Depot — Website

Marketing site for The Deli Depot, Unit 5, Pant Industrial Estate, Merthyr Tydfil.

Plain HTML/CSS/JS — no build step. Drop it on any host, and it works.

---

## File layout

```
the-deli-depot-website/
├── index.html                    ← homepage with deli menu + meal prep promo
├── menu.html                     ← meal prep weekly menu page
├── meal.html                     ← single meal product page (uses ?id= URL param)
├── build-your-own.html           ← meal builder with 4 steps
├── css/
│   ├── style.css                 ← main site styles
│   └── meal-prep.css             ← meal prep feature styles
├── js/
│   ├── main.js                   ← nav, scroll effects, deli menu
│   ├── basket.js                 ← localStorage basket management
│   ├── menu.js                   ← meal prep grid, filters, sorting
│   ├── meal.js                   ← single meal page, bundle selection
│   └── builder.js                ← build-your-own form, live macros
├── data/
│   ├── menu.json                 ← existing deli menu (unchanged)
│   └── meal-prep-menu.json       ← meal prep weekly menu data
├── assets/images/                ← drop real images here
└── README.md
```

---

## Updating the meal prep menu

### Weekly menu rotation

Open [`data/meal-prep-menu.json`](data/meal-prep-menu.json). The file contains:

```json
{
  "week_of": "2026-05-25",
  "order_cutoff": "5pm day before collection",
  "collection_location": "Pant Industrial Estate, Merthyr Tydfil",
  "meals": [
    {
      "id": "powerhouse",
      "name": "The Powerhouse",
      "tagline": "Piri Piri Chicken · Basmati · Tenderstem",
      "category": "signature",
      "description": "...",
      "image": "assets/meals/powerhouse.jpg",
      "macros": { "kcal": 485, "protein": 52, "carbs": 38, "fat": 12 },
      "price_single": 7.50,
      "price_bundle_5": 33.50,
      "price_bundle_10": 64.00,
      "tags": ["high-protein", "gluten-free", "lean"],
      "protein_source": "chicken",
      "goal": ["lean", "maintenance"],
      "new_this_week": true,
      ...
    }
    // ... more meals
  ]
}
```

**To update for the week:**
1. Update `week_of` with the new week start date (e.g., "2026-06-01")
2. Edit the `meals` array:
   - Modify existing meal prices, macros, descriptions, or ingredients
   - Add new meals by copying an existing entry and updating all fields
   - Remove meals by deleting their object from the array
   - Set `new_this_week: true` on newly added meals (only)
3. Ensure all required fields are present (id, name, tagline, price_single, price_bundle_5, price_bundle_10, macros, etc.)
4. Save the file
5. Commit and push to trigger a Netlify deploy

**Changes go live** on the next Netlify deploy automatically.

### Field reference

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | string | `"powerhouse"` | Unique identifier, used in URLs and data links |
| `name` | string | `"The Powerhouse"` | Display name on cards |
| `tagline` | string | `"Piri Piri Chicken · Basmati · Tenderstem"` | Short 1-liner, shown above name |
| `category` | string | `"signature"` | For future filtering (not currently used in UI) |
| `description` | string | Long paragraph | Full meal description shown on product page |
| `image` | string | `"assets/meals/powerhouse.jpg"` | Relative path to meal image |
| `macros` | object | `{ "kcal": 485, "protein": 52, "carbs": 38, "fat": 12 }` | Per-meal nutritional values |
| `price_single` | number | `7.50` | Price for 1x meal |
| `price_bundle_5` | number | `33.50` | Price for 5x meal pack (usually discounted) |
| `price_bundle_10` | number | `64.00` | Price for 10x meal pack |
| `tags` | array | `["high-protein", "gluten-free"]` | Filter tags (see filter list below) |
| `protein_source` | string | `"chicken"` | One of: chicken, beef, salmon, plant-based |
| `goal` | array | `["lean", "maintenance"]` | One or more of: lean, bulk, maintenance |
| `ingredients` | string | Long list | Full ingredients, shown in product page accordion |
| `allergens_contains` | array | `["mustard"]` | Declared allergens (bold on page) |
| `allergens_may_contain` | array | `["gluten", "nuts"]` | Possible cross-contamination (italic on page) |
| `heat_instructions` | string | Microwave/oven steps | Full heating instructions |
| `storage` | string | Fridge/freezer info | Storage and shelf life |
| `new_this_week` | boolean | `true` or `false` | Shows "New This Week" badge if true |

**Valid tag values** (for filtering):
- `high-protein`
- `low-carb`
- `under-500-kcal`
- `gluten-free`
- `vegetarian`
- `omega-3`
- `lean`
- `bulk`
- `maintenance`
- `breakfast`
- `mediterranean`

**Valid `protein_source` values:**
- `chicken`
- `beef`
- `salmon`
- `plant-based`

**Valid `goal` values:**
- `lean`
- `bulk`
- `maintenance`

### Adding meal images

Place meal images in the `assets/meals/` folder (create the folder if it doesn't exist) with the filename matching the `image` field in the JSON.

**Example:** If `"image": "assets/meals/powerhouse.jpg"`, create or upload `assets/meals/powerhouse.jpg`.

If an image fails to load, the page shows a dark gold-bordered placeholder. Ensure filenames match exactly (case-sensitive on Linux servers).

### Testing locally

1. Edit `data/meal-prep-menu.json`
2. Run a local server: `python -m http.server` or `npx http-server`
3. Visit `http://localhost:8000/menu.html` to preview changes
4. The menu filters, sorting, and meal details will update instantly

---

## Editing the deli menu

Open [`data/menu.json`](data/menu.json). Each item is an object:

```json
{
  "category": "sandwiches",
  "name": "The Depot Classic",
  "price": "£4.95",
  "description": "Fresh ham, mature cheddar, tomato...",
  "tag": "Signature"
}
```

- **`category`** must be one of: `sandwiches`, `salad-bar`, `hot-food`, `deli-counter`, `drinks`, `sweet-treats`, `pots`. These match the filter buttons in [index.html](index.html).
- **`tag`** is optional — a little badge shown on the card (e.g. "Veggie", "Signature", "Welsh").
- **`price`** can be any string — `£4.95`, `from £2.50`, or leave it empty.

Add a new category:
1. Add items with a new `"category": "new-name"` in `menu.json`.
2. Open [`index.html`](index.html), find the `<div class="menu__filters">` block, add a new chip button:
   ```html
   <button class="chip" data-filter="new-name" role="tab" aria-selected="false">New Name</button>
   ```

Save, refresh the page, done.

---

## Swapping images

See [`assets/images/README.txt`](assets/images/README.txt) for the full list of image slots and what each should show.

Short version: drop a real image in `assets/images/` with the expected filename, then replace the matching `<div class="image-placeholder" ...>` in [index.html](index.html) with an `<img>` tag:

```html
<img src="assets/images/about.jpg" alt="Making a fresh sandwich at The Deli Depot" />
```

Compress images first with [squoosh.app](https://squoosh.app) — aim for under 300KB each.

---

## Updating contact details

In [index.html](index.html), find and replace:

| Placeholder                  | Replace with               |
| ---------------------------- | -------------------------- |
| `TBC — add phone number`     | real phone number          |
| `+44-000-000-0000`           | real phone in schema block |
| `hello@thedelidepot.co.uk`   | real email                 |
| Opening hours (two places)   | if they change             |

Social links — find `https://facebook.com/`, `https://tiktok.com/`, `https://instagram.com/` and replace with the full URLs.

---

## Running locally

Because the menu loads via `fetch()`, you need a local server — opening `index.html` directly will show a "menu loading…" message.

Easiest options:

```bash
# Python (built in on Mac/Linux, usually available on Windows too)
python -m http.server 8000

# Node
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000).

---

## Deploying

### Netlify (recommended — free, fast, easy)

1. Sign up at [netlify.com](https://www.netlify.com).
2. **Option A — drag & drop:** zip the whole folder, drop it on the Netlify dashboard. Live in 30 seconds.
3. **Option B — git:** push this folder to GitHub, connect the repo in Netlify. Every push auto-deploys.
4. The contact form's `data-netlify="true"` attribute means Netlify will auto-capture submissions — view them in the "Forms" tab of your Netlify dashboard.

### Vercel

1. Sign up at [vercel.com](https://vercel.com).
2. `npm i -g vercel`, then `vercel` from inside this folder.
3. Follow the prompts — takes a minute.

### Render / any static host

Any static file host works. Just upload the folder contents to your web root.

### Custom domain

In your host's dashboard, add the domain you bought (e.g. `thedelidepot.co.uk`). Follow their DNS instructions — usually one CNAME or A record. SSL is automatic on Netlify/Vercel.

---

## What's intentionally left for you

- **Real phone number & email** — see above.
- **Real images** — see `assets/images/README.txt`.
- **Menu content** — the JSON has realistic placeholders; swap with your actual items/prices.
- **Social URLs** — replace the bare `facebook.com/`, `tiktok.com/`, `instagram.com/` with your actual pages.
- **Google Maps** — the embed searches for "Pant Industrial Estate Merthyr Tydfil". Once you know the exact pin, go to Google Maps → Share → Embed a map → copy the `src` URL, paste it into the `<iframe src="...">` in the contact section.

---

## Tech notes

- **No framework.** Vanilla HTML/CSS/JS. Anyone can maintain this without build tools.
- **Accessibility:** skip link, focus states, ARIA on nav & menu filters, `prefers-reduced-motion` support, semantic HTML.
- **SEO:** meta tags, Open Graph, Twitter Card, `LocalBusiness` + `FoodEstablishment` JSON-LD schema.
- **Performance:** one CSS file, one JS file, fonts preconnected, images lazy-loaded (maps iframe too), no external JS libraries.
- **Mobile-first:** designed for phones; scales up to tablet and desktop.

---

## Trouble?

- Menu not showing? → You're probably viewing `index.html` directly. Use `python -m http.server` or deploy it.
- Form not sending? → On Netlify it auto-works. Locally, the form falls back to opening the user's email app (mailto).
- Map blank? → Google occasionally rate-limits the basic embed. For production, get a Maps Embed API key (free tier) and swap the iframe `src`.
