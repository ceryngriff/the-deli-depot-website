// =========================================================
// MEAL PREP MENU
// Loads active meals from Supabase, renders the grid,
// handles filters + sort. Add-to-basket uses the global
// window.MealPrepBasket exposed by basket.js.
// =========================================================

import { supabase } from './supabase.js';

let allMeals = [];
let filteredMeals = [];
const state = {
  sort: 'popular',
  dietary: [],
  protein: [],
  goal: []
};

// ---------- DATA ----------

// Map a Supabase `meals` row into the shape the rest of this file expects.
function shapeMeal(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || '',
    category: row.category || 'signature',
    description: row.description || '',
    image: row.image_url || '',
    macros: {
      kcal: row.kcal ?? 0,
      protein: row.protein_g ?? 0,
      carbs: row.carbs_g ?? 0,
      fat: row.fat_g ?? 0
    },
    price_single: parseFloat(row.price_single ?? 0),
    price_bundle_5: parseFloat(row.price_bundle_5 ?? 0),
    price_bundle_10: parseFloat(row.price_bundle_10 ?? 0),
    tags: row.tags || [],
    protein_source: row.protein_source || '',
    goal: row.goal_tags || [],
    new_this_week: !!row.new_this_week,
    sort_order: row.sort_order ?? 0
  };
}

async function loadMenuData() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[menu] load error', error);
    showError('Unable to load menu. Please refresh the page.');
    return null;
  }
  allMeals = (data || []).map(shapeMeal);
  filteredMeals = [...allMeals];
  return allMeals;
}

// ---------- RENDER ----------

function renderCards(meals) {
  const grid = document.getElementById('meal-grid');
  if (!grid) return;

  if (meals.length === 0) {
    grid.innerHTML = `
      <p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:3rem 1rem;">
        No meals match these filters. Try clearing one or two.
      </p>`;
    return;
  }

  grid.innerHTML = meals.map((meal) => `
    <article class="meal-card" data-slug="${escapeHtml(meal.slug)}">
      <div class="meal-card__image-wrap">
        ${meal.image ? `
          <img
            class="meal-card__image"
            src="${escapeHtml(meal.image)}"
            alt="${escapeHtml(meal.name)}"
            loading="lazy"
            onerror="this.style.display='none'; this.parentElement.classList.add('is-placeholder');"
          />
        ` : ''}
        ${meal.new_this_week ? '<span class="meal-card__badge-new">New</span>' : ''}
        ${meal.tags && meal.tags[0] ? `<span class="meal-card__badge-tag">${escapeHtml(meal.tags[0].replace(/-/g, ' '))}</span>` : ''}
      </div>
      <div class="meal-card__body">
        <p class="meal-card__tagline">${escapeHtml(meal.tagline)}</p>
        <h3 class="meal-card__title">${escapeHtml(meal.name)}</h3>
        <p class="meal-card__description">${escapeHtml(meal.description)}</p>
        <div class="meal-card__macros">
          <div class="macro"><span class="macro__value">${meal.macros.kcal}</span><span class="macro__label">Kcal</span></div>
          <div class="macro"><span class="macro__value">${meal.macros.protein}g</span><span class="macro__label">Protein</span></div>
          <div class="macro"><span class="macro__value">${meal.macros.carbs}g</span><span class="macro__label">Carbs</span></div>
          <div class="macro"><span class="macro__value">${meal.macros.fat}g</span><span class="macro__label">Fat</span></div>
        </div>
        <div class="meal-card__footer">
          <span class="meal-card__price">£${meal.price_single.toFixed(2)}</span>
          <button class="meal-card__add-btn" data-slug="${escapeHtml(meal.slug)}"
                  aria-label="Add ${escapeHtml(meal.name)} to basket">Add +</button>
        </div>
      </div>
    </article>
  `).join('');

  // Add-to-basket buttons
  grid.querySelectorAll('.meal-card__add-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      const meal = allMeals.find((m) => m.slug === slug);
      if (meal) addToBasketFromCard(meal, btn);
    });
  });

  // Card click → product page
  grid.querySelectorAll('.meal-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.meal-card__add-btn')) return;
      window.location.href = `meal.html?slug=${encodeURIComponent(card.dataset.slug)}`;
    });
  });
}

function addToBasketFromCard(meal, btn) {
  if (!window.MealPrepBasket) return;
  window.MealPrepBasket.addToBasket({
    id: meal.slug,
    meal_id: meal.id,
    slug: meal.slug,
    name: meal.name,
    price: meal.price_single,
    bundle: 'single',
    quantity: 1,
    macros: meal.macros,
    image: meal.image
  });
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Added';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
  }
}

// ---------- FILTERS / SORT ----------

function applyFilters() {
  filteredMeals = allMeals.filter((meal) => {
    if (state.dietary.length > 0) {
      const has = state.dietary.some((t) => meal.tags.includes(t));
      if (!has) return false;
    }
    if (state.protein.length > 0) {
      if (!state.protein.includes(meal.protein_source)) return false;
    }
    if (state.goal.length > 0) {
      const has = state.goal.some((g) => meal.goal.includes(g));
      if (!has) return false;
    }
    return true;
  });
  sortMeals();
  renderCards(filteredMeals);
  updateFilterCounts();
}

function sortMeals() {
  switch (state.sort) {
    case 'popular':
      filteredMeals.sort((a, b) => a.sort_order - b.sort_order);
      break;
    case 'protein-high':
      filteredMeals.sort((a, b) => b.macros.protein - a.macros.protein);
      break;
    case 'calorie-low':
      filteredMeals.sort((a, b) => a.macros.kcal - b.macros.kcal);
      break;
    case 'price-low':
      filteredMeals.sort((a, b) => a.price_single - b.price_single);
      break;
    case 'new':
      filteredMeals.sort((a, b) => {
        if (a.new_this_week && !b.new_this_week) return -1;
        if (!a.new_this_week && b.new_this_week) return 1;
        return 0;
      });
      break;
  }
}

function updateFilterCounts() {
  // Counts are computed against the FULL meal set so toggling a filter
  // doesn't make the others read "(0)".
  document.querySelectorAll('[name="dietary"]').forEach((cb) => {
    const tag = cb.value;
    const count = allMeals.filter((m) => m.tags.includes(tag)).length;
    const el = cb.closest('.filter-option')?.querySelector('.filter-option__count');
    if (el) el.textContent = `(${count})`;
  });
  document.querySelectorAll('[name="protein"]').forEach((cb) => {
    const source = cb.value;
    const count = allMeals.filter((m) => m.protein_source === source).length;
    const el = cb.closest('.filter-option')?.querySelector('.filter-option__count');
    if (el) el.textContent = `(${count})`;
  });
  document.querySelectorAll('[name="goal"]').forEach((cb) => {
    const goal = cb.value;
    const count = allMeals.filter((m) => m.goal.includes(goal)).length;
    const el = cb.closest('.filter-option')?.querySelector('.filter-option__count');
    if (el) el.textContent = `(${count})`;
  });
}

function setupEventListeners() {
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters();
  });

  document.querySelectorAll('[name="dietary"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.dietary = Array.from(document.querySelectorAll('[name="dietary"]:checked')).map((c) => c.value);
      applyFilters();
    });
  });
  document.querySelectorAll('[name="protein"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.protein = Array.from(document.querySelectorAll('[name="protein"]:checked')).map((c) => c.value);
      applyFilters();
    });
  });
  document.querySelectorAll('[name="goal"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.goal = Array.from(document.querySelectorAll('[name="goal"]:checked')).map((c) => c.value);
      applyFilters();
    });
  });

  // Mobile filter modal
  const filterToggle = document.querySelector('.meal-filters-toggle');
  const filterModal = document.querySelector('.meal-filters');
  const closeBtn = document.querySelector('.meal-filters__close');
  filterToggle?.addEventListener('click', () => filterModal?.classList.toggle('is-open'));
  closeBtn?.addEventListener('click', () => filterModal?.classList.remove('is-open'));
}

// ---------- HELPERS ----------

function showError(message) {
  const grid = document.getElementById('meal-grid');
  if (grid) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem;">${escapeHtml(message)}</p>`;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- INIT ----------

(async function init() {
  const data = await loadMenuData();
  if (data) {
    renderCards(filteredMeals);
    updateFilterCounts();
    setupEventListeners();
  }
})();
