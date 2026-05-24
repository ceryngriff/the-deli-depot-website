// =========================================================
// BASKET PAGE
// Renders the cart items, quantity controls, removal,
// suggested add-ons, and "Proceed to Checkout".
// =========================================================

import { supabase } from './supabase.js';
import { loadCustomerAllergens, checkMeal, buildWarningEl, labelFor } from './allergens.js';

const basket = window.MealPrepBasket;

function bundleLabel(bundle) {
  switch (bundle) {
    case 'single':         return 'Single Meal';
    case 'bundle_5':
    case '5':              return '5 Pack';
    case 'bundle_10':
    case '10':             return '10 Pack';
    case 'build_your_own':
    case 'custom':         return 'Build Your Own';
    default:               return 'Single Meal';
  }
}

function buildSummary(custom) {
  if (!custom) return '';
  const bits = [];
  if (custom.protein) bits.push(`${custom.protein}${custom.proteinPortion ? ` ${custom.proteinPortion}g` : ''}`);
  if (custom.carb)    bits.push(custom.carb);
  if (custom.veg?.length) bits.push(custom.veg.join(' + '));
  if (custom.sauce)   bits.push(`${custom.sauce} sauce`);
  return bits.join(' · ');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function render() {
  const list  = document.getElementById('basket-list');
  const summarySub = document.getElementById('summary-subtotal');
  const summaryTotal = document.getElementById('summary-total');
  const proceedBtn = document.getElementById('proceed-checkout');
  const emptyState = document.getElementById('basket-empty');
  const cartLayout = document.getElementById('cart-layout');
  if (!list) return;

  const items = basket.getBasket();

  if (items.length === 0) {
    cartLayout.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  cartLayout.style.display = '';

  list.innerHTML = items.map((item) => {
    const total = (item.price * item.quantity).toFixed(2);
    const buildLine = buildSummary(item.custom);
    return `
      <div class="basket-item" data-key="${escapeHtml(item.key)}">
        <div class="basket-item__image-wrap">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none'" />` : ''}
        </div>
        <div class="basket-item__info">
          <h3 class="basket-item__name">${escapeHtml(item.name)}</h3>
          <p class="basket-item__bundle">${escapeHtml(bundleLabel(item.bundle))}</p>
          ${item.macros ? `
            <p class="basket-item__macros">${item.macros.kcal} kcal · ${item.macros.protein}g protein · ${item.macros.carbs}g carbs · ${item.macros.fat}g fat</p>
          ` : ''}
          ${buildLine ? `<p class="basket-item__build">${escapeHtml(buildLine)}</p>` : ''}
        </div>
        <div class="basket-item__controls">
          <span class="basket-item__total">£${total}</span>
          <div class="basket-item__qty" role="group" aria-label="Quantity for ${escapeHtml(item.name)}">
            <button data-act="dec" aria-label="Decrease quantity">−</button>
            <span>${item.quantity}</span>
            <button data-act="inc" aria-label="Increase quantity">+</button>
          </div>
          <button class="basket-item__remove" data-act="remove">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  // Subtotal / total
  const subtotal = basket.getBasketTotal();
  if (summarySub)   summarySub.textContent = `£${subtotal.toFixed(2)}`;
  if (summaryTotal) summaryTotal.textContent = `£${subtotal.toFixed(2)}`;
  if (proceedBtn)   proceedBtn.disabled = false;

  // Wire up the controls
  list.querySelectorAll('.basket-item').forEach((row) => {
    const key = row.dataset.key;
    row.querySelector('[data-act="dec"]')?.addEventListener('click', () => {
      const item = basket.getBasket().find((i) => i.key === key);
      if (item) basket.updateQuantity(key, Math.max(1, item.quantity - 1));
      render();
    });
    row.querySelector('[data-act="inc"]')?.addEventListener('click', () => {
      const item = basket.getBasket().find((i) => i.key === key);
      if (item) basket.updateQuantity(key, item.quantity + 1);
      render();
    });
    row.querySelector('[data-act="remove"]')?.addEventListener('click', () => {
      basket.removeFromBasket(key);
      render();
    });
  });
}

// ---------- ADD-ON SUGGESTIONS ----------

async function loadAddons() {
  const addonStrip = document.getElementById('addon-strip');
  const addonGrid  = document.getElementById('addon-grid');
  if (!addonStrip || !addonGrid) return;

  const { data, error } = await supabase
    .from('meals')
    .select('id, slug, name, price_single, image_url')
    .eq('is_active', true)
    .eq('category', 'add-on')
    .order('sort_order', { ascending: true })
    .limit(3);

  if (error || !data || data.length === 0) {
    addonStrip.style.display = 'none';
    return;
  }

  addonGrid.innerHTML = data.map((m) => `
    <div class="addon-card">
      <p class="addon-card__name">${escapeHtml(m.name)}</p>
      <p class="addon-card__price">£${parseFloat(m.price_single).toFixed(2)}</p>
      <button class="btn btn--sm" data-slug="${escapeHtml(m.slug)}" data-id="${escapeHtml(m.id)}"
              data-name="${escapeHtml(m.name)}" data-price="${m.price_single}"
              data-image="${escapeHtml(m.image_url || '')}">Add to Basket</button>
    </div>
  `).join('');

  addonGrid.querySelectorAll('button[data-slug]').forEach((btn) => {
    btn.addEventListener('click', () => {
      basket.addToBasket({
        id: btn.dataset.slug,
        meal_id: btn.dataset.id,
        slug: btn.dataset.slug,
        name: btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        bundle: 'single',
        quantity: 1,
        image: btn.dataset.image || ''
      });
      render();
    });
  });
}

// ---------- ALLERGEN WARNINGS ----------
//
// Cross-reference the basket's meals (by meal_id) against the
// signed-in customer's declared allergens. Renders a single banner
// above the basket list if anything in the basket conflicts.

async function renderAllergenWarning() {
  // Clear old banner first
  document.querySelectorAll('.allergen-warning').forEach((el) => el.remove());

  const customerAllergens = await loadCustomerAllergens();
  if (customerAllergens.length === 0) return;

  const items = basket.getBasket();
  const mealIds = Array.from(new Set(items.map((i) => i.meal_id).filter(Boolean)));
  if (mealIds.length === 0) return;

  // Fetch allergens for each unique meal in the basket
  const { data: meals } = await supabase
    .from('meals')
    .select('id, name, allergens_contains, allergens_may_contain')
    .in('id', mealIds);
  if (!meals) return;

  const offenders = [];
  const cautions = [];
  meals.forEach((m) => {
    const r = checkMeal(m, customerAllergens);
    if (r.contains.length) {
      offenders.push({ name: m.name, allergens: r.contains });
    } else if (r.mayContain.length) {
      cautions.push({ name: m.name, allergens: r.mayContain });
    }
  });

  if (offenders.length === 0 && cautions.length === 0) return;

  const div = document.createElement('div');
  div.className = offenders.length ? 'allergen-warning' : 'allergen-warning allergen-warning--may';
  let body = '';
  if (offenders.length) {
    body += `<p>${offenders.map((o) =>
      `<strong style="color: #f4b3a8;">${escapeHtml(o.name)}</strong> contains ${o.allergens.map(labelFor).join(', ')}`
    ).join(' · ')}.</p>`;
  }
  if (cautions.length) {
    body += `<p>${cautions.map((c) =>
      `<strong>${escapeHtml(c.name)}</strong> may contain ${c.allergens.map(labelFor).join(', ')}`
    ).join(' · ')}.</p>`;
  }
  div.innerHTML = `
    <strong>${offenders.length ? '⚠️ Allergen alert' : '⚠️ Possible allergens'}</strong>
    ${body}
    <p class="allergen-warning__hint">You set these in your <a href="account.html?tab=profile">account profile</a>.</p>
  `;

  const layout = document.getElementById('cart-layout');
  const list   = document.getElementById('basket-list');
  if (layout && list) layout.insertBefore(div, list.parentNode);
}

// ---------- INIT ----------

document.getElementById('proceed-checkout')?.addEventListener('click', () => {
  window.location.href = 'checkout.html';
});

render();
loadAddons();
renderAllergenWarning();

// React to basket changes from any tab.
document.addEventListener('basket-updated', () => {
  render();
  renderAllergenWarning();
});
window.addEventListener('storage', (e) => {
  if (e.key === 'dd_basket') {
    render();
    renderAllergenWarning();
  }
});
