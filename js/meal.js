/* =========================================================
   MEAL PRODUCT PAGE MODULE
   Loads single meal, handles bundle selection and basket
   ========================================================= */

const MealProductPage = (() => {
  'use strict';

  let meal = null;
  const state = {
    bundle: '5',
    quantity: 1
  };

  /**
   * Get meal ID from URL params
   */
  function getMealIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  /**
   * Load meal data
   */
  async function loadMeal(mealId) {
    try {
      const response = await fetch('data/meal-prep-menu.json');
      if (!response.ok) throw new Error('Failed to load menu');
      const data = await response.json();
      meal = data.meals.find(m => m.id === mealId);
      
      if (!meal) {
        showError('Meal not found');
        return null;
      }
      
      return meal;
    } catch (e) {
      console.error('Meal loading error:', e);
      showError('Unable to load meal details. Please try again.');
      return null;
    }
  }

  /**
   * Render the product page
   */
  function renderProductPage() {
    if (!meal) return;

    // Update breadcrumb
    const breadcrumb = document.querySelector('.breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <a href="menu.html">Menu</a>
        <span>/</span>
        <span>${escapeHtml(meal.name)}</span>
      `;
    }

    // Update page title
    document.title = `${meal.name} | The Deli Depot Meal Prep`;

    // Product image and badges
    const imageMain = document.querySelector('.product-image-main img');
    if (imageMain) {
      imageMain.src = meal.image;
      imageMain.alt = meal.name;
      imageMain.onerror = function() { this.classList.add('is-placeholder'); this.style.display = 'none'; };
    }

    // New badge
    if (meal.new_this_week) {
      const mainWrap = document.querySelector('.product-image-main');
      if (mainWrap && !mainWrap.querySelector('.meal-card__badge-new')) {
        const newBadge = document.createElement('span');
        newBadge.className = 'meal-card__badge-new';
        newBadge.textContent = 'New This Week';
        mainWrap.appendChild(newBadge);
      }
    }

    // Tag badge
    if (meal.tags && meal.tags[0]) {
      const mainWrap = document.querySelector('.product-image-main');
      if (mainWrap && !mainWrap.querySelector('.meal-card__badge-tag')) {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'meal-card__badge-tag';
        tagBadge.textContent = meal.tags[0].replace(/-/g, ' ');
        mainWrap.appendChild(tagBadge);
      }
    }

    // Product info
    document.querySelector('.product-info__accent').textContent = meal.category.charAt(0).toUpperCase() + meal.category.slice(1);
    document.querySelector('.product-info__title').textContent = meal.name;
    document.querySelector('.product-info__tagline').textContent = meal.tagline;
    document.querySelector('.product-info__description').textContent = meal.description;

    // Macros
    const macrosContainer = document.querySelector('.product-macros');
    macrosContainer.innerHTML = `
      <div>
        <span class="product-macros__label">Calories</span>
        <p class="product-macros__value">${meal.macros.kcal}</p>
      </div>
      <div>
        <span class="product-macros__label">Protein</span>
        <p class="product-macros__value">${meal.macros.protein}g</p>
      </div>
      <div>
        <span class="product-macros__label">Carbs</span>
        <p class="product-macros__value">${meal.macros.carbs}g</p>
      </div>
      <div>
        <span class="product-macros__label">Fat</span>
        <p class="product-macros__value">${meal.macros.fat}g</p>
      </div>
    `;

    // Bundle selector
    renderBundleSelector();

    // Accordion content
    renderAccordionContent();

    // Setup event listeners
    setupEventListeners();

    // Update add button price
    updateAddButtonPrice();
  }

  /**
   * Render bundle selection
   */
  function renderBundleSelector() {
    const container = document.querySelector('.bundle-selector');
    if (!container) return;

    const bundles = [
      { id: 'single', name: 'Single', price: meal.price_single, savings: null },
      { id: '5', name: '5 Pack', price: meal.price_bundle_5, savings: (meal.price_single * 5 - meal.price_bundle_5).toFixed(2) },
      { id: '10', name: '10 Pack', price: meal.price_bundle_10, savings: (meal.price_single * 10 - meal.price_bundle_10).toFixed(2) }
    ];

    container.innerHTML = bundles.map(bundle => `
      <label class="bundle-option ${bundle.id === '5' ? 'is-selected' : ''}">
        <input type="radio" name="bundle" value="${bundle.id}" ${bundle.id === '5' ? 'checked' : ''} />
        <span class="bundle-option__size">${escapeHtml(bundle.name)}</span>
        <span class="bundle-option__price">£${bundle.price.toFixed(2)}</span>
        ${bundle.savings ? `<span class="bundle-option__savings">Save £${bundle.savings}</span>` : ''}
      </label>
    `).join('');
  }

  /**
   * Render accordion content
   */
  function renderAccordionContent() {
    // Ingredients & Allergens (open by default)
    const ingredientsContent = document.querySelector('[data-accordion="ingredients"] .accordion-content__inner');
    if (ingredientsContent) {
      ingredientsContent.innerHTML = `
        <p><strong>Ingredients:</strong></p>
        <p>${escapeHtml(meal.ingredients)}</p>
        <p style="margin-top: 1rem;">
          <strong>Contains:</strong> ${meal.allergens_contains.length > 0 ? escapeHtml(meal.allergens_contains.join(', ')) : 'None'}<br/>
          <em>May contain:</em> ${meal.allergens_may_contain.length > 0 ? escapeHtml(meal.allergens_may_contain.join(', ')) : 'None'}
        </p>
      `;
      document.querySelector('[data-accordion="ingredients"] .accordion-trigger').click();
    }

    // Heat & Eat
    const heatContent = document.querySelector('[data-accordion="heat"] .accordion-content__inner');
    if (heatContent) {
      heatContent.innerHTML = `<p>${escapeHtml(meal.heat_instructions)}</p>`;
    }

    // Collection
    const collectionContent = document.querySelector('[data-accordion="collection"] .accordion-content__inner');
    if (collectionContent) {
      collectionContent.innerHTML = `
        <p>
          <strong>Collection Location:</strong><br/>
          The Deli Depot<br/>
          Unit 5, Pant Industrial Estate<br/>
          Merthyr Tydfil
        </p>
        <p><strong>Order Cutoff:</strong> 5pm day before collection</p>
      `;
    }

    // Storage
    const storageContent = document.querySelector('[data-accordion="storage"] .accordion-content__inner');
    if (storageContent) {
      storageContent.innerHTML = `<p>${escapeHtml(meal.storage)}</p>`;
    }
  }

  /**
   * Update add button price
   */
  function updateAddButtonPrice() {
    const btn = document.querySelector('.add-to-basket-btn');
    if (btn) {
      const bundlePrice = getBundlePrice();
      const totalPrice = (bundlePrice * state.quantity).toFixed(2);
      btn.textContent = `Add to Basket — £${totalPrice}`;
    }
  }

  /**
   * Get current bundle price
   */
  function getBundlePrice() {
    const bundleMap = {
      'single': meal.price_single,
      '5': meal.price_bundle_5,
      '10': meal.price_bundle_10
    };
    return bundleMap[state.bundle] || meal.price_single;
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Bundle selection
    document.querySelectorAll('input[name="bundle"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.bundle = e.target.value;
        document.querySelectorAll('.bundle-option').forEach(opt => opt.classList.remove('is-selected'));
        e.target.closest('.bundle-option').classList.add('is-selected');
        updateAddButtonPrice();
      });
    });

    // Quantity stepper
    const qtyInput = document.querySelector('.quantity-stepper input');
    const qtyMinus = document.querySelector('.quantity-stepper button[aria-label*="Decrease"]');
    const qtyPlus = document.querySelector('.quantity-stepper button[aria-label*="Increase"]');

    if (qtyMinus) qtyMinus.addEventListener('click', () => {
      state.quantity = Math.max(1, state.quantity - 1);
      qtyInput.value = state.quantity;
      updateAddButtonPrice();
    });

    if (qtyPlus) qtyPlus.addEventListener('click', () => {
      state.quantity += 1;
      qtyInput.value = state.quantity;
      updateAddButtonPrice();
    });

    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        state.quantity = Math.max(1, parseInt(qtyInput.value) || 1);
        qtyInput.value = state.quantity;
        updateAddButtonPrice();
      });
    }

    // Add to basket button
    const addBtn = document.querySelector('.add-to-basket-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const bundlePrice = getBundlePrice();
        MealPrepBasket.addToBasket({
          id: meal.id,
          name: meal.name,
          price: bundlePrice,
          bundle: state.bundle,
          quantity: state.quantity,
          macros: meal.macros,
          image: meal.image
        });

        // Visual feedback
        const originalText = addBtn.textContent;
        addBtn.textContent = '✓ Added to Basket';
        addBtn.disabled = true;
        setTimeout(() => {
          addBtn.textContent = originalText;
          addBtn.disabled = false;
        }, 1500);
      });
    }

    // Accordion triggers
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        const trigger = e.currentTarget;
        const content = trigger.nextElementSibling;
        const isOpen = trigger.classList.contains('is-open');

        // Close all accordions
        document.querySelectorAll('.accordion-trigger').forEach(t => {
          t.classList.remove('is-open');
          t.nextElementSibling.classList.remove('is-open');
        });

        // Open clicked accordion (if it wasn't already open)
        if (!isOpen) {
          trigger.classList.add('is-open');
          content.classList.add('is-open');
        }
      });
    });
  }

  /**
   * Show error
   */
  function showError(msg) {
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `
        <div class="container" style="padding: 4rem 0; text-align: center; color: var(--muted);">
          <p>${escapeHtml(msg)}</p>
          <p><a href="menu.html">← Back to Menu</a></p>
        </div>
      `;
    }
  }

  /**
   * HTML escape
   */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /**
   * Initialize
   */
  async function init() {
    const mealId = getMealIdFromUrl();
    if (!mealId) {
      showError('No meal specified. Please visit the menu.');
      return;
    }

    const loaded = await loadMeal(mealId);
    if (loaded) {
      renderProductPage();
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, loadMeal };
})();
