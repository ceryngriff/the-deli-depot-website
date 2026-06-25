# 🚨 Allergen Verification — Build Your Own

**Status: TEMPORARY BLANKET CAUTION IS LIVE.**
Until this checklist is done, every Build Your Own meal tells customers it
**"may contain any of the 14 major allergens"**. That's deliberately
over-cautious so nothing slips through before ingredients are verified.

Do this **after the stock purge + delivery**, once you can read every label.

---

## The 14 allergen keys used in the code
Use these exact spellings in the `allergens: [...]` arrays:

`dairy` · `gluten` · `eggs` · `fish` · `crustaceans` · `molluscs` · `nuts`
(tree nuts) · `peanuts` · `sesame` · `soy` · `celery` · `mustard` ·
`sulphites` · `lupin`

(Defined in [`js/allergens.js`](js/allergens.js).)

---

## Step 1 — Set the REAL allergens on each ingredient
File: [`js/builder.js`](js/builder.js) → the `INGREDIENTS` object.
For every item, read the actual product label and set its `allergens: [...]`.

### Proteins — confirm each
- [ ] Grilled Chicken Breast — currently `[]`
- [ ] Lean Beef Mince — currently `[]`
- [ ] Salmon Fillet — currently `['fish']`
- [ ] Turkey Breast — currently `[]`
- [ ] Tofu — currently `['soy']`
- [ ] Griddled Halloumi — currently `['dairy']`
- [ ] Smoked Bacon Medallions — currently `['sulphites']` (check cure)
- [ ] Boiled Eggs — currently `['eggs']`

### Carb bases — confirm each
- [ ] Basmati Rice — `[]`
- [ ] Sweet Potato — `[]`
- [ ] Wholewheat Pasta — `['gluten']` (check for egg too)
- [ ] Quinoa — `[]`
- [ ] Cauliflower Rice — `[]`
- [ ] Courgetti Noodles — `[]`
- [ ] Mixed Leaves — `[]`
- [ ] No Carb — `[]`

### Vegetables — confirm each
- [ ] Tenderstem Broccoli — `[]`
- [ ] Roasted Peppers — `[]`
- [ ] Green Beans — `[]`
- [ ] Roasted Carrots — `[]`
- [ ] Wilted Spinach — `[]`
- [ ] Courgette Ribbons — `[]`
- [ ] Sliced Avocado — `[]`

### Sauces — ⚠️ THESE ARE GUESSES, VERIFY ALL
- [ ] Piri Piri — currently `[]` (check garlic/sulphites)
- [ ] Tikka — currently `['dairy']` (yoghurt base?)
- [ ] BBQ — currently `['mustard', 'sulphites']` (very brand-dependent)
- [ ] Sweet Chilli — currently `[]` (check fish sauce!)
- [ ] Garlic Herb — currently `['dairy']`
- [ ] Lemon Pepper — currently `[]`
- [ ] Garlic Butter — currently `['dairy']`
- [ ] Cheddar Cheese Sauce — currently `['dairy', 'gluten']`

> Tip: if a sauce is bought in, the allergens are printed in **bold** in the
> ingredients list on the back. Copy those exactly.

---

## Step 2 — Tighten the "may contain" blanket
File: [`js/builder.js`](js/builder.js)

Right now custom meals declare `allergens_may_contain: ALL_ALLERGEN_KEYS`
(all 14). Once Step 1 is done, change this to only the **genuine
cross-contamination risks in your kitchen** — i.e. allergens that are present
on your prep surfaces/equipment but not necessarily in that specific build.

- [ ] Decide your real cross-contamination list (e.g. `['gluten','dairy','eggs','sesame']` — whatever you actually handle)
- [ ] Replace `ALL_ALLERGEN_KEYS` in the `addToBasket` call with that list
      (or a `const KITCHEN_CROSS_CONTAMINATION = [...]`)
- [ ] Update the summary note text in `updateSummary()` so it no longer says
      "any of the 14 major allergens" / "not yet allergen-verified"

---

## Step 3 — Test
- [ ] Build a meal with **Boiled Eggs + Cheese Sauce** → summary should show
      `Contains: Eggs, Dairy, Gluten`
- [ ] Sign in as a test customer with an allergen set in account profile,
      add a custom meal, open the basket → allergen banner should fire
- [ ] Place a test order → check the order's `build_details.allergens` and
      `build_details.allergens_may_contain` are saved correctly

---

## Where everything lives
| What | File |
|------|------|
| Ingredient allergen data + summary line | `js/builder.js` |
| Allergen keys, labels, matching logic | `js/allergens.js` |
| Basket allergen banner (incl. custom meals) | `js/basket-page.js` |
| Order record (`build_details.allergens*`) | `js/checkout.js` |
| Badge / summary styling | `css/meal-prep.css` |

---

_Created as a reminder while the blanket caution is active. Delete this file
once Steps 1–3 are complete and verified._
