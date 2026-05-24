// =========================================================
// ALLERGENS — shared list + customer-warning helpers.
// Used by account.js (profile form), meal.js (product page),
// and basket-page.js (basket review).
// =========================================================

import { supabase } from './supabase.js';
import { getSession } from './auth.js';

// Common allergen labels. We match against meal.allergens_contains /
// allergens_may_contain case-insensitively, and accept synonyms
// ('dairy' ↔ 'milk', 'soy' ↔ 'soybeans') so we don't break existing
// meal data that uses either form.
export const ALLERGENS = [
  { key: 'dairy',      label: 'Dairy / Milk',  aliases: ['milk'] },
  { key: 'gluten',     label: 'Gluten',        aliases: ['wheat', 'cereals'] },
  { key: 'eggs',       label: 'Eggs',          aliases: [] },
  { key: 'fish',       label: 'Fish',          aliases: [] },
  { key: 'crustaceans',label: 'Crustaceans',   aliases: [] },
  { key: 'molluscs',   label: 'Molluscs',      aliases: [] },
  { key: 'nuts',       label: 'Tree nuts',     aliases: [] },
  { key: 'peanuts',    label: 'Peanuts',       aliases: [] },
  { key: 'sesame',     label: 'Sesame',        aliases: [] },
  { key: 'soy',        label: 'Soy',           aliases: ['soybeans', 'soya'] },
  { key: 'celery',     label: 'Celery',        aliases: [] },
  { key: 'mustard',    label: 'Mustard',       aliases: [] },
  { key: 'sulphites',  label: 'Sulphites',     aliases: ['sulfites'] },
  { key: 'lupin',      label: 'Lupin',         aliases: [] }
];

// Build a set of (lowercased) keys + aliases that match `term`.
function matchAny(termList, customerAllergens) {
  if (!termList || !customerAllergens?.length) return [];
  const lower = termList.map((t) => String(t).toLowerCase().trim());
  const matched = new Set();
  customerAllergens.forEach((key) => {
    const entry = ALLERGENS.find((a) => a.key === key);
    if (!entry) {
      // Custom key not in our list — try a direct text match anyway
      if (lower.includes(key.toLowerCase())) matched.add(key);
      return;
    }
    const candidates = [entry.key, ...entry.aliases].map((s) => s.toLowerCase());
    if (lower.some((t) => candidates.includes(t))) matched.add(entry.key);
  });
  return Array.from(matched);
}

// Returns { contains: [keys...], mayContain: [keys...] } against a meal.
// `meal` is either a Supabase row or the shape used by meal.js / basket.
export function checkMeal(meal, customerAllergens) {
  const contains = meal?.allergens_contains || [];
  const may      = meal?.allergens_may_contain || [];
  return {
    contains:   matchAny(contains, customerAllergens),
    mayContain: matchAny(may,      customerAllergens)
  };
}

// Returns the current customer's allergens (empty array if not signed in
// or no allergens set).
export async function loadCustomerAllergens() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('allergens')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error || !data) return [];
  return data.allergens || [];
}

// Build a labelled human-readable string for a list of matched keys.
export function labelFor(key) {
  return ALLERGENS.find((a) => a.key === key)?.label || key;
}

// Render an inline allergen warning banner element. Returns null if
// no warning is needed (customer has no allergens, or none match).
export function buildWarningEl({ contains, mayContain }) {
  if (!contains.length && !mayContain.length) return null;
  const div = document.createElement('div');
  div.className = contains.length ? 'allergen-warning' : 'allergen-warning allergen-warning--may';
  const containsLabels = contains.map(labelFor).join(', ');
  const mayLabels      = mayContain.map(labelFor).join(', ');
  div.innerHTML = `
    <strong>${contains.length ? '⚠️ Contains allergens you flagged' : '⚠️ May contain allergens you flagged'}</strong>
    <p>${
      contains.length
        ? `This meal contains ${containsLabels}.`
        : `This meal may contain ${mayLabels} (cross-contamination risk).`
    }${mayContain.length && contains.length ? ` It may also contain ${mayLabels}.` : ''}</p>
    <p class="allergen-warning__hint">You set this in your <a href="account.html?tab=profile">account profile</a>. If you've changed your mind, edit it there.</p>
  `;
  return div;
}
