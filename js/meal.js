// =========================================================
// SINGLE MEAL PAGE
// Loads the meal by ?slug= (preferred) or ?id= (UUID),
// renders product info, bundle selector, accordion, basket.
// =========================================================

import { supabase } from './supabase.js';

let meal = null;
const state = { bundle: '5', quantity: 1 };

// ---------- URL ----------

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return { slug: p.get('slug'), id: p.get('id') };
}

// ---------- SHAPE ----------

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
    ingredients: row.ingredients || '',
    allergens_contains: row.allergens_contains || [],
    allergens_may_contain: row.allergens_may_contain || [],
    heat_instructions: row.heat_instructions || '',
    storage: row.storage || '',
    new_this_week: !!row.new_this_week
  };
}

// ---------- LOAD ----------

async function loadMeal() {
  const { slug, id } = getParams();
  if (!slug && !id) {
    showError('No meal specified. Visit the menu to pick one.');
    return null;
  }

  let q = supabase.from('meals').select('*').eq('is_active', true).limit(1);
  if (slug) q = q.eq('slug', slug);
  else q = q.eq('id', id);

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error('[meal] load error', error);
    showError('Unable to load this meal. Please try again.');
    return null;
  }
  if (!data) {
    showError('Meal not found. It may have been removed from the menu.');
    return null;
  }
  meal = shapeMeal(data);
  return meal;
}

// ---------- RENDER ----------

function renderProductPage() {
  if (!meal) return;

  // Breadcrumb
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="menu.html">Menu</a>
      <span>/</span>
      <span>${escapeHtml(meal.name)}</span>
    `;
  }

  // Title
  document.title = `${meal.name} | The Deli Depot Meal Prep`;

  // Main image
  const imageMain = document.querySelector('.product-image-main img');
  if (imageMain) {
    if (meal.image) {
      imageMain.src = meal.image;
      imageMain.alt = meal.name;
      imageMain.onerror = function () {
        this.style.display = 'none';
        this.parentElement.classList.add('is-placeholder');
        this.parentElement.textContent = meal.name;
      };
    } else {
      imageMain.style.display = 'none';
      imageMain.parentElement.classList.add('is-placeholder');
      imageMain.parentElement.textContent = meal.name;
    }
  }

  // New badge
  const mainWrap = document.querySelector('.product-image-main');
  if (meal.new_this_week && mainWrap && !mainWrap.querySelector('.meal-card__badge-new')) {
    const b = document.createElement('span');
    b.className = 'meal-card__badge-new';
    b.textContent = 'New This Week';
    mainWrap.appendChild(b);
  }
  if (meal.tags?.[0] && mainWrap && !mainWrap.querySelector('.meal-card__badge-tag')) {
    const b = document.createElement('span');
    b.className = 'meal-card__badge-tag';
    b.textContent = meal.tags[0].replace(/-/g, ' ');
    mainWrap.appendChild(b);
  }

  // Product info
  const accent = document.querySelector('.product-info__accent');
  if (accent) accent.textContent = meal.category.charAt(0).toUpperCase() + meal.category.slice(1);
  const title = document.querySelector('.product-info__title');
  if (title) title.textContent = meal.name;
  const tagline = document.querySelector('.product-info__tagline');
  if (tagline) tagline.textContent = meal.tagline;
  const desc = document.querySelector('.product-info__description');
  if (desc) desc.textContent = meal.description;

  // Macros
  const macros = document.querySelector('.product-macros');
  if (macros) {
    macros.innerHTML = `
      <div><span class="product-macros__label">Calories</span><p class="product-macros__value">${meal.macros.kcal}</p></div>
      <div><span class="product-macros__label">Protein</span><p class="product-macros__value">${meal.macros.protein}g</p></div>
      <div><span class="product-macros__label">Carbs</span><p class="product-macros__value">${meal.macros.carbs}g</p></div>
      <div><span class="product-macros__label">Fat</span><p class="product-macros__value">${meal.macros.fat}g</p></div>
    `;
  }

  renderBundleSelector();
  renderAccordionContent();
  setupEventListeners();
  updateAddButtonPrice();
}

function renderBundleSelector() {
  const container = document.querySelector('.bundle-selector');
  if (!container) return;

  const bundles = [
    { id: 'single', name: 'Single', price: meal.price_single, savings: null },
    { id: '5', name: '5 Pack', price: meal.price_bundle_5, savings: (meal.price_single * 5 - meal.price_bundle_5).toFixed(2) },
    { id: '10', name: '10 Pack', price: meal.price_bundle_10, savings: (meal.price_single * 10 - meal.price_bundle_10).toFixed(2) }
  ];

  container.innerHTML = bundles.map((b) => `
    <label class="bundle-option ${b.id === state.bundle ? 'is-selected' : ''}">
      <input type="radio" name="bundle" value="${b.id}" ${b.id === state.bundle ? 'checked' : ''} />
      <span class="bundle-option__size">${escapeHtml(b.name)}</span>
      <span class="bundle-option__price">£${b.price.toFixed(2)}</span>
      ${b.savings && Number(b.savings) > 0 ? `<span class="bundle-option__savings">Save £${b.savings}</span>` : ''}
    </label>
  `).join('');
}

function renderAccordionContent() {
  const ingredientsBox = document.querySelector('[data-accordion="ingredients"] .accordion-content__inner');
  if (ingredientsBox) {
    ingredientsBox.innerHTML = `
      <p><strong>Ingredients:</strong></p>
      <p>${escapeHtml(meal.ingredients)}</p>
      <p style="margin-top: 1rem;">
        <strong>Contains:</strong> ${meal.allergens_contains.length ? escapeHtml(meal.allergens_contains.join(', ')) : 'None declared'}<br/>
        <em>May contain:</em> ${meal.allergens_may_contain.length ? escapeHtml(meal.allergens_may_contain.join(', ')) : 'None'}
      </p>
    `;
    // Open by default
    const trigger = document.querySelector('[data-accordion="ingredients"] .accordion-trigger');
    trigger?.classList.add('is-open');
    trigger?.nextElementSibling?.classList.add('is-open');
  }

  const heatBox = document.querySelector('[data-accordion="heat"] .accordion-content__inner');
  if (heatBox) heatBox.innerHTML = `<p>${escapeHtml(meal.heat_instructions)}</p>`;

  const collectionBox = document.querySelector('[data-accordion="collection"] .accordion-content__inner');
  if (collectionBox) {
    collectionBox.innerHTML = `
      <p>
        <strong>Collection Location:</strong><br/>
        The Deli Depot<br/>
        Unit 5, Pant Industrial Estate<br/>
        Merthyr Tydfil
      </p>
      <p><strong>Order Cutoff:</strong> 5pm day before collection</p>
    `;
  }

  const storageBox = document.querySelector('[data-accordion="storage"] .accordion-content__inner');
  if (storageBox) storageBox.innerHTML = `<p>${escapeHtml(meal.storage)}</p>`;
}

// ---------- PRICE ----------

function getBundlePrice() {
  switch (state.bundle) {
    case 'single': return meal.price_single;
    case '5':      return meal.price_bundle_5;
    case '10':     return meal.price_bundle_10;
    default:       return meal.price_single;
  }
}

function updateAddButtonPrice() {
  const btn = document.querySelector('.add-to-basket-btn');
  if (!btn) return;
  const total = (getBundlePrice() * state.quantity).toFixed(2);
  btn.textContent = `Add to Basket — £${total}`;
}

// ---------- INTERACTIONS ----------

function setupEventListeners() {
  document.querySelectorAll('input[name="bundle"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      state.bundle = e.target.value;
      document.querySelectorAll('.bundle-option').forEach((o) => o.classList.remove('is-selected'));
      e.target.closest('.bundle-option')?.classList.add('is-selected');
      updateAddButtonPrice();
    });
  });

  const qtyInput = document.querySelector('.quantity-stepper input');
  const qtyMinus = document.querySelector('.quantity-stepper button[aria-label*="Decrease"]');
  const qtyPlus = document.querySelector('.quantity-stepper button[aria-label*="Increase"]');

  qtyMinus?.addEventListener('click', () => {
    state.quantity = Math.max(1, state.quantity - 1);
    if (qtyInput) qtyInput.value = state.quantity;
    updateAddButtonPrice();
  });
  qtyPlus?.addEventListener('click', () => {
    state.quantity += 1;
    if (qtyInput) qtyInput.value = state.quantity;
    updateAddButtonPrice();
  });
  qtyInput?.addEventListener('change', () => {
    state.quantity = Math.max(1, parseInt(qtyInput.value) || 1);
    qtyInput.value = state.quantity;
    updateAddButtonPrice();
  });

  const addBtn = document.querySelector('.add-to-basket-btn');
  addBtn?.addEventListener('click', () => {
    if (!window.MealPrepBasket) return;
    const bundleType = state.bundle === 'single' ? 'single'
      : state.bundle === '5' ? 'bundle_5'
      : 'bundle_10';
    window.MealPrepBasket.addToBasket({
      id: meal.slug,
      meal_id: meal.id,
      slug: meal.slug,
      name: meal.name,
      price: getBundlePrice(),
      bundle: bundleType,
      quantity: state.quantity,
      macros: meal.macros,
      image: meal.image
    });
    const original = addBtn.textContent;
    addBtn.textContent = '✓ Added to Basket';
    addBtn.disabled = true;
    setTimeout(() => { addBtn.textContent = original; addBtn.disabled = false; }, 1500);
  });

  // Accordion
  document.querySelectorAll('.accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isOpen = trigger.classList.contains('is-open');
      document.querySelectorAll('.accordion-trigger').forEach((t) => {
        t.classList.remove('is-open');
        t.nextElementSibling?.classList.remove('is-open');
      });
      if (!isOpen) {
        trigger.classList.add('is-open');
        trigger.nextElementSibling?.classList.add('is-open');
      }
    });
  });
}

// ---------- HELPERS ----------

function showError(msg) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div class="container" style="padding: 5rem 1rem; text-align: center; color: var(--cream-muted);">
      <p style="font-size: 1.1rem;">${escapeHtml(msg)}</p>
      <p style="margin-top: 1.5rem;"><a href="menu.html" class="btn">Back to Menu</a></p>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- INIT ----------

(async function init() {
  const loaded = await loadMeal();
  if (loaded) renderProductPage();
})();
