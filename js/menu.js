// =========================================================
// MEAL PREP MENU
// Loads active meals from Supabase, renders the grid,
// handles filters + sort. Add-to-basket uses the global
// window.MealPrepBasket exposed by basket.js.
// =========================================================

let allMeals = [];
let filteredMeals = [];
const state = {
  sort: 'popular',
  dietary: [],
  protein: [],
  goal: []
};

// ---------- DATA ----------
// Hard-coded weekly menu. This is the source of truth for the menu grid —
// no network/Supabase call, so the page always renders. To change the menu,
// edit the MENU array below (keep it in sync with data/meal-prep-menu.json).

const MENU = [
  {
    id: 'powerhouse', slug: 'powerhouse', name: 'The Powerhouse',
    tagline: 'Piri Piri Chicken · Basmati · Tenderstem', category: 'signature',
    description: 'Marinated grilled chicken breast over fluffy basmati rice, finished with charred tenderstem broccoli and roasted peppers. Smoky, lean and built to fuel a heavy training session.',
    image: 'assets/meals/powerhouse.webp',
    macros: { kcal: 485, protein: 52, carbs: 38, fat: 12 },
    price_single: 7.50, price_bundle_5: 33.50, price_bundle_10: 64.00,
    tags: ['high-protein', 'gluten-free', 'lean'], protein_source: 'chicken',
    goal: ['lean', 'maintenance'], new_this_week: true, sort_order: 1
  },
  {
    id: 'beef-spud', slug: 'beef-spud', name: 'Beef & Sweet Spud',
    tagline: 'Slow-braised beef, sweet potato, kale', category: 'signature',
    description: 'Tender braised beef chuck steak with roasted sweet potato wedges, massaged kale and a rich beefy jus. Perfect for bulking season or weekend energy.',
    image: 'assets/meals/beef-spud.webp',
    macros: { kcal: 620, protein: 48, carbs: 58, fat: 18 },
    price_single: 8.00, price_bundle_5: 36.00, price_bundle_10: 68.00,
    tags: ['high-protein', 'bulk'], protein_source: 'beef',
    goal: ['bulk', 'maintenance'], new_this_week: false, sort_order: 2
  },
  {
    id: 'honey-salmon', slug: 'honey-salmon', name: 'Honey Glazed Salmon',
    tagline: 'Salmon, jasmine rice, edamame slaw', category: 'signature',
    description: 'Pan-seared salmon fillet with a light honey and soy glaze, served on fluffy jasmine rice with a crisp edamame and sesame slaw. Omega-3 packed and restaurant quality.',
    image: 'assets/meals/honey-salmon.webp',
    macros: { kcal: 540, protein: 42, carbs: 44, fat: 16 },
    price_single: 9.00, price_bundle_5: 40.50, price_bundle_10: 77.00,
    tags: ['high-protein', 'omega-3', 'lean'], protein_source: 'salmon',
    goal: ['lean', 'maintenance'], new_this_week: false, sort_order: 3
  },
  {
    id: 'halloumi-couscous', slug: 'halloumi-couscous', name: 'Halloumi & Couscous',
    tagline: 'Griddled halloumi, lemon couscous, med veg', category: 'signature',
    description: 'Squeaky-fresh halloumi cheese griddled until golden, with fluffy lemon couscous and a medley of roasted Mediterranean vegetables. Vegetarian crowd-pleaser.',
    image: 'assets/meals/halloumi-couscous.webp',
    macros: { kcal: 510, protein: 26, carbs: 48, fat: 22 },
    price_single: 7.00, price_bundle_5: 31.50, price_bundle_10: 60.00,
    tags: ['vegetarian', 'mediterranean'], protein_source: 'plant-based',
    goal: ['lean', 'maintenance'], new_this_week: true, sort_order: 4
  },
  {
    id: 'tikka-chicken', slug: 'tikka-chicken', name: 'Tikka Chicken Bowl',
    tagline: 'Tandoori chicken, cauli rice, raita', category: 'signature',
    description: 'Spiced tandoori chicken thighs with cauliflower rice, cooling natural yogurt raita and toasted cumin seeds. Low-carb, high-protein, and deeply aromatic.',
    image: 'assets/meals/tikka-chicken.webp',
    macros: { kcal: 395, protein: 46, carbs: 14, fat: 15 },
    price_single: 7.50, price_bundle_5: 33.50, price_bundle_10: 64.00,
    tags: ['high-protein', 'low-carb', 'under-500-kcal', 'gluten-free'], protein_source: 'chicken',
    goal: ['lean', 'maintenance'], new_this_week: false, sort_order: 5
  },
  {
    id: 'banana-oats', slug: 'banana-oats', name: 'Banana Protein Oats',
    tagline: 'Overnight oats, whey, banana, almond butter', category: 'breakfast',
    description: 'Creamy overnight oats blended with whey protein powder, topped with sliced banana, almond butter, granola crunch and a drizzle of honey. Grab-and-go breakfast fuel.',
    image: 'assets/meals/banana-oats.jpg',
    macros: { kcal: 420, protein: 32, carbs: 52, fat: 10 },
    price_single: 4.50, price_bundle_5: 20.00, price_bundle_10: 38.00,
    tags: ['breakfast', 'high-protein', 'vegetarian', 'under-500-kcal'], protein_source: 'plant-based',
    goal: ['maintenance'], new_this_week: false, sort_order: 6
  }
];

function loadMenuData() {
  allMeals = MENU.map((m) => ({ ...m }));
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

(function init() {
  loadMenuData();
  renderCards(filteredMeals);
  updateFilterCounts();
  setupEventListeners();
})();
