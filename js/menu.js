/* =========================================================
   MEAL PREP MENU MODULE
   Loads menu data, renders cards, handles filters
   ========================================================= */

const MealPrepMenu = (() => {
  'use strict';

  let allMeals = [];
  let filteredMeals = [];
  const state = {
    sort: 'popular',
    dietary: [],
    protein: [],
    goal: []
  };

  /**
   * Load meal data from JSON
   */
  async function loadMenuData() {
    try {
      const response = await fetch('data/meal-prep-menu.json');
      if (!response.ok) throw new Error('Failed to load menu');
      const data = await response.json();
      allMeals = data.meals || [];
      filteredMeals = [...allMeals];
      return data;
    } catch (e) {
      console.error('Menu loading error:', e);
      showError('Unable to load menu. Please refresh the page.');
      return null;
    }
  }

  /**
   * Render meal cards in the grid
   */
  function renderCards(meals) {
    const grid = document.getElementById('meal-grid');
    if (!grid) return;

    grid.innerHTML = meals.map(meal => `
      <article class="meal-card" data-id="${escapeHtml(meal.id)}">
        <div class="meal-card__image-wrap">
          ${meal.image ? `
            <img 
              class="meal-card__image" 
              src="${escapeHtml(meal.image)}" 
              alt="${escapeHtml(meal.name)}"
              loading="lazy"
              onerror="this.classList.add('is-placeholder'); this.style.display='none';"
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
            <div class="macro">
              <span class="macro__value">${meal.macros.kcal}</span>
              <span class="macro__label">Kcal</span>
            </div>
            <div class="macro">
              <span class="macro__value">${meal.macros.protein}g</span>
              <span class="macro__label">Protein</span>
            </div>
            <div class="macro">
              <span class="macro__value">${meal.macros.carbs}g</span>
              <span class="macro__label">Carbs</span>
            </div>
            <div class="macro">
              <span class="macro__value">${meal.macros.fat}g</span>
              <span class="macro__label">Fat</span>
            </div>
          </div>
          <div class="meal-card__footer">
            <span class="meal-card__price">£${meal.price_single.toFixed(2)}</span>
            <button class="meal-card__add-btn" data-id="${escapeHtml(meal.id)}" aria-label="Add ${escapeHtml(meal.name)} to basket">
              Add +
            </button>
          </div>
        </div>
      </article>
    `).join('');

    // Attach click handlers for the "Add +" buttons
    grid.querySelectorAll('.meal-card__add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mealId = btn.dataset.id;
        const meal = allMeals.find(m => m.id === mealId);
        if (meal) {
          addToBasketFromCard(meal);
        }
      });
    });

    // Attach click handlers for whole card to navigate to product page
    grid.querySelectorAll('.meal-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.meal-card__add-btn')) {
          const mealId = card.dataset.id;
          window.location.href = `meal.html?id=${mealId}`;
        }
      });
    });
  }

  /**
   * Add meal to basket from card (single portion)
   */
  function addToBasketFromCard(meal) {
    MealPrepBasket.addToBasket({
      id: meal.id,
      name: meal.name,
      price: meal.price_single,
      bundle: 'single',
      quantity: 1,
      macros: meal.macros,
      image: meal.image
    });

    // Visual feedback
    const btn = document.querySelector(`[data-id="${meal.id}"]`);
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ Added';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    }
  }

  /**
   * Apply filters and re-render
   */
  function applyFilters() {
    filteredMeals = allMeals.filter(meal => {
      // Dietary filters
      if (state.dietary.length > 0) {
        const hasTag = state.dietary.some(d => meal.tags && meal.tags.includes(d));
        if (!hasTag) return false;
      }

      // Protein source filters
      if (state.protein.length > 0) {
        if (!state.protein.includes(meal.protein_source)) return false;
      }

      // Goal filters
      if (state.goal.length > 0) {
        const hasGoal = state.goal.some(g => meal.goal && meal.goal.includes(g));
        if (!hasGoal) return false;
      }

      return true;
    });

    // Sort
    sortMeals();
    renderCards(filteredMeals);
    updateFilterCounts();
  }

  /**
   * Sort meals
   */
  function sortMeals() {
    switch (state.sort) {
      case 'popular':
        // Keep original order (popularity determined by order in JSON)
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

  /**
   * Update filter counts
   */
  function updateFilterCounts() {
    // Count dietary tags
    const dietaryCheckboxes = document.querySelectorAll('[name="dietary"]');
    dietaryCheckboxes.forEach(cb => {
      const tag = cb.value;
      const count = filteredMeals.filter(m => m.tags && m.tags.includes(tag)).length;
      const countEl = cb.closest('.filter-option')?.querySelector('.filter-option__count');
      if (countEl) countEl.textContent = `(${count})`;
    });

    // Count protein sources
    const proteinCheckboxes = document.querySelectorAll('[name="protein"]');
    proteinCheckboxes.forEach(cb => {
      const source = cb.value;
      const count = filteredMeals.filter(m => m.protein_source === source).length;
      const countEl = cb.closest('.filter-option')?.querySelector('.filter-option__count');
      if (countEl) countEl.textContent = `(${count})`;
    });

    // Count goals
    const goalCheckboxes = document.querySelectorAll('[name="goal"]');
    goalCheckboxes.forEach(cb => {
      const goal = cb.value;
      const count = filteredMeals.filter(m => m.goal && m.goal.includes(goal)).length;
      const countEl = cb.closest('.filter-option')?.querySelector('.filter-option__count');
      if (countEl) countEl.textContent = `(${count})`;
    });
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Sort dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        applyFilters();
      });
    }

    // Dietary checkboxes
    document.querySelectorAll('[name="dietary"]').forEach(cb => {
      cb.addEventListener('change', () => {
        state.dietary = Array.from(document.querySelectorAll('[name="dietary"]:checked'))
          .map(c => c.value);
        applyFilters();
      });
    });

    // Protein checkboxes
    document.querySelectorAll('[name="protein"]').forEach(cb => {
      cb.addEventListener('change', () => {
        state.protein = Array.from(document.querySelectorAll('[name="protein"]:checked'))
          .map(c => c.value);
        applyFilters();
      });
    });

    // Goal checkboxes
    document.querySelectorAll('[name="goal"]').forEach(cb => {
      cb.addEventListener('change', () => {
        state.goal = Array.from(document.querySelectorAll('[name="goal"]:checked'))
          .map(c => c.value);
        applyFilters();
      });
    });

    // Mobile filter toggle
    const filterToggle = document.querySelector('.meal-filters-toggle');
    const filterModal = document.querySelector('.meal-filters');
    const closeBtn = document.querySelector('.meal-filters__close');

    if (filterToggle && filterModal) {
      filterToggle.addEventListener('click', () => {
        filterModal.classList.toggle('is-open');
      });
    }

    if (closeBtn && filterModal) {
      closeBtn.addEventListener('click', () => {
        filterModal.classList.remove('is-open');
      });
    }

    // Close filter modal when a filter is checked on mobile
    document.querySelectorAll('.filter-option input').forEach(input => {
      input.addEventListener('change', () => {
        if (window.innerWidth < 940) {
          filterModal?.classList.remove('is-open');
        }
      });
    });
  }

  /**
   * Show error message
   */
  function showError(message) {
    const grid = document.getElementById('meal-grid');
    if (grid) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem;">${escapeHtml(message)}</p>`;
    }
  }

  /**
   * HTML escape utility
   */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /**
   * Initialize menu
   */
  async function init() {
    const data = await loadMenuData();
    if (data) {
      renderCards(filteredMeals);
      updateFilterCounts();
      setupEventListeners();
    }
  }

  // Auto-init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return { init, loadMenuData, renderCards, applyFilters };
})();
