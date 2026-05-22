/* =========================================================
   MEAL BUILDER MODULE
   Build-your-own meal with live macros and pricing
   ========================================================= */

const MealBuilder = (() => {
  'use strict';

  // Ingredient macros and pricing
  const INGREDIENTS = {
    proteins: [
      { id: 'chicken', name: 'Grilled Chicken Breast', basePrice: 5.50, portionPrice: 1.00, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
      { id: 'beef', name: 'Lean Beef Mince', basePrice: 6.00, portionPrice: 1.00, kcal: 250, protein: 26, carbs: 0, fat: 15 },
      { id: 'salmon', name: 'Salmon Fillet', basePrice: 7.00, portionPrice: 1.50, kcal: 280, protein: 25, carbs: 0, fat: 20 },
      { id: 'turkey', name: 'Turkey Breast', basePrice: 5.50, portionPrice: 1.00, kcal: 165, protein: 29, carbs: 0, fat: 3.8 },
      { id: 'tofu', name: 'Tofu', basePrice: 4.50, portionPrice: 0.75, kcal: 76, protein: 8, carbs: 1.9, fat: 4.8 },
      { id: 'halloumi', name: 'Griddled Halloumi', basePrice: 5.50, portionPrice: 1.00, kcal: 330, protein: 26, carbs: 0.7, fat: 27 }
    ],
    carbs: [
      { id: 'basmati', name: 'Basmati Rice', priceModifier: 0, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
      { id: 'sweet-potato', name: 'Sweet Potato', priceModifier: 0, kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
      { id: 'pasta', name: 'Wholewheat Pasta', priceModifier: 0, kcal: 124, protein: 4.3, carbs: 25, fat: 0.5 },
      { id: 'quinoa', name: 'Quinoa', priceModifier: 0.50, kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
      { id: 'leaves', name: 'Mixed Leaves', priceModifier: 0, kcal: 15, protein: 2.6, carbs: 2.9, fat: 0.3 },
      { id: 'no-carb', name: 'No Carb', priceModifier: -0.50, kcal: 0, protein: 0, carbs: 0, fat: 0 }
    ],
    veg: [
      { id: 'broccoli', name: 'Tenderstem Broccoli', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
      { id: 'peppers', name: 'Roasted Peppers', kcal: 37, protein: 0.9, carbs: 9, fat: 0.3 },
      { id: 'beans', name: 'Green Beans', kcal: 31, protein: 2.1, carbs: 7, fat: 0.2 },
      { id: 'carrots', name: 'Roasted Carrots', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
      { id: 'spinach', name: 'Wilted Spinach', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
      { id: 'courgette', name: 'Courgette Ribbons', kcal: 17, protein: 1.2, carbs: 3.2, fat: 0.4 }
    ],
    sauces: [
      { id: 'piri', name: 'Piri Piri', kcal: 20, protein: 0, carbs: 2, fat: 1.5 },
      { id: 'tikka', name: 'Tikka', kcal: 18, protein: 0.5, carbs: 1, fat: 1 },
      { id: 'bbq', name: 'BBQ', kcal: 22, protein: 0, carbs: 5, fat: 0.3 },
      { id: 'sweet-chilli', name: 'Sweet Chilli', kcal: 25, protein: 0, carbs: 6, fat: 0.2 },
      { id: 'garlic-herb', name: 'Garlic Herb', kcal: 30, protein: 0.3, carbs: 1, fat: 3 },
      { id: 'lemon-pepper', name: 'Lemon Pepper', kcal: 15, protein: 0, carbs: 0.5, fat: 1.5 }
    ]
  };

  const state = {
    protein: null,
    proteinPortion: 150,
    carb: null,
    veg: [],
    sauce: null
  };

  /**
   * Calculate price for a protein
   */
  function getProteinPrice(protein, portion = 150) {
    const basePortions = Math.floor(portion / 50);
    const extraCost = Math.max(0, (portion - 150) / 50) * protein.portionPrice;
    return protein.basePrice + extraCost;
  }

  /**
   * Calculate total macros
   */
  function calculateMacros() {
    let macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    if (state.protein) {
      const proteinObj = INGREDIENTS.proteins.find(p => p.id === state.protein);
      const portionRatio = state.proteinPortion / 100;
      macros.kcal += proteinObj.kcal * portionRatio;
      macros.protein += proteinObj.protein * portionRatio;
      macros.carbs += proteinObj.carbs * portionRatio;
      macros.fat += proteinObj.fat * portionRatio;
    }

    if (state.carb) {
      const carbObj = INGREDIENTS.carbs.find(c => c.id === state.carb);
      macros.kcal += carbObj.kcal;
      macros.protein += carbObj.protein;
      macros.carbs += carbObj.carbs;
      macros.fat += carbObj.fat;
    }

    state.veg.forEach(vegId => {
      const vegObj = INGREDIENTS.veg.find(v => v.id === vegId);
      if (vegObj) {
        macros.kcal += vegObj.kcal;
        macros.protein += vegObj.protein;
        macros.carbs += vegObj.carbs;
        macros.fat += vegObj.fat;
      }
    });

    if (state.sauce) {
      const sauceObj = INGREDIENTS.sauces.find(s => s.id === state.sauce);
      macros.kcal += sauceObj.kcal;
      macros.protein += sauceObj.protein;
      macros.carbs += sauceObj.carbs;
      macros.fat += sauceObj.fat;
    }

    return {
      kcal: Math.round(macros.kcal),
      protein: Math.round(macros.protein * 10) / 10,
      carbs: Math.round(macros.carbs * 10) / 10,
      fat: Math.round(macros.fat * 10) / 10
    };
  }

  /**
   * Calculate total price
   */
  function calculatePrice() {
    let price = 0;

    if (state.protein) {
      const proteinObj = INGREDIENTS.proteins.find(p => p.id === state.protein);
      price += getProteinPrice(proteinObj, state.proteinPortion);
    }

    if (state.carb) {
      const carbObj = INGREDIENTS.carbs.find(c => c.id === state.carb);
      price += carbObj.priceModifier;
    }

    if (state.sauce) {
      // Sauce is included
    }

    return parseFloat(price.toFixed(2));
  }

  /**
   * Check if builder is complete
   */
  function isComplete() {
    return state.protein && state.carb && state.veg.length === 2 && state.sauce;
  }

  /**
   * Render protein step
   */
  function renderStep1() {
    const container = document.getElementById('step-1-options');
    if (!container) return;

    container.innerHTML = INGREDIENTS.proteins.map(protein => `
      <div class="builder-options">
        <label class="builder-option ${state.protein === protein.id ? 'is-selected' : ''}">
          <input type="radio" name="protein" value="${protein.id}" ${state.protein === protein.id ? 'checked' : ''} />
          <span class="builder-option__name">${escapeHtml(protein.name)}</span>
          <span class="builder-option__price">£${getProteinPrice(protein, 150).toFixed(2)}</span>
        </label>
        ${state.protein === protein.id ? renderPortionSelector(protein) : ''}
      </div>
    `).join('');

    // Re-wrap in proper grid
    const optionsWrapper = container.parentElement;
    optionsWrapper.innerHTML = `<div class="builder-options" style="grid-column: 1 / -1;">
      ${INGREDIENTS.proteins.map(protein => `
        <div>
          <label class="builder-option ${state.protein === protein.id ? 'is-selected' : ''}">
            <input type="radio" name="protein" value="${protein.id}" ${state.protein === protein.id ? 'checked' : ''} />
            <span class="builder-option__name">${escapeHtml(protein.name)}</span>
            <span class="builder-option__price">From £${protein.basePrice.toFixed(2)}</span>
          </label>
        </div>
      `).join('')}
    </div>`;

    if (state.protein) {
      const proteinLabel = optionsWrapper.querySelector(`[value="${state.protein}"]`);
      if (proteinLabel) {
        proteinLabel.closest('.builder-option').insertAdjacentHTML('afterend', `
          <div class="portion-selector" style="grid-column: 1 / -1; margin-top: 1rem;">
            <span style="color: var(--cream-muted); font-size: 0.9rem;">Portion size:</span>
            ${[150, 200, 250].map(size => `
              <button type="button" class="portion-btn ${state.proteinPortion === size ? 'is-selected' : ''}" data-portion="${size}">
                ${size}g
              </button>
            `).join('')}
          </div>
        `);
      }
    }
  }

  /**
   * Render portion selector buttons
   */
  function renderPortionSelector(protein) {
    return `
      <div class="portion-selector" style="margin-top: 0.5rem; grid-column: 1 / -1;">
        ${[150, 200, 250].map(size => `
          <button type="button" class="portion-btn ${state.proteinPortion === size ? 'is-selected' : ''}" data-portion="${size}">
            ${size}g
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render carb step
   */
  function renderStep2() {
    const container = document.getElementById('step-2-options');
    if (!container) return;

    const wrapper = container.closest('.builder-options') || container.parentElement;
    wrapper.innerHTML = `<div class="builder-options">
      ${INGREDIENTS.carbs.map(carb => `
        <label class="builder-option ${state.carb === carb.id ? 'is-selected' : ''}">
          <input type="radio" name="carb" value="${carb.id}" ${state.carb === carb.id ? 'checked' : ''} />
          <span class="builder-option__name">${escapeHtml(carb.name)}</span>
          ${carb.priceModifier !== 0 ? `<span class="builder-option__price">${carb.priceModifier > 0 ? '+' : ''}£${Math.abs(carb.priceModifier).toFixed(2)}</span>` : ''}
        </label>
      `).join('')}
    </div>`;
  }

  /**
   * Render veg step
   */
  function renderStep3() {
    const container = document.getElementById('step-3-options');
    if (!container) return;

    const wrapper = container.closest('.builder-options') || container.parentElement;
    wrapper.innerHTML = `<div class="builder-options">
      ${INGREDIENTS.veg.map(veg => `
        <label class="builder-option ${state.veg.includes(veg.id) ? 'is-selected' : ''}">
          <input type="checkbox" name="veg" value="${veg.id}" ${state.veg.includes(veg.id) ? 'checked' : ''} />
          <span class="builder-option__name">${escapeHtml(veg.name)}</span>
          <span class="builder-option__info">(Pick 2)</span>
        </label>
      `).join('')}
    </div>`;
  }

  /**
   * Render sauce step
   */
  function renderStep4() {
    const container = document.getElementById('step-4-options');
    if (!container) return;

    const wrapper = container.closest('.builder-options') || container.parentElement;
    wrapper.innerHTML = `<div class="builder-options">
      ${INGREDIENTS.sauces.map(sauce => `
        <label class="builder-option ${state.sauce === sauce.id ? 'is-selected' : ''}">
          <input type="radio" name="sauce" value="${sauce.id}" ${state.sauce === sauce.id ? 'checked' : ''} />
          <span class="builder-option__name">${escapeHtml(sauce.name)}</span>
          <span class="builder-option__info">Included</span>
        </label>
      `).join('')}
    </div>`;
  }

  /**
   * Update summary
   */
  function updateSummary() {
    const summaryItems = document.querySelector('.builder-summary__items');
    if (summaryItems) {
      let html = '';

      if (state.protein) {
        const p = INGREDIENTS.proteins.find(x => x.id === state.protein);
        html += `<p class="builder-summary__item"><strong>${p.name}</strong> <span>(${state.proteinPortion}g)</span></p>`;
      }

      if (state.carb) {
        const c = INGREDIENTS.carbs.find(x => x.id === state.carb);
        html += `<p class="builder-summary__item"><strong>${c.name}</strong></p>`;
      }

      state.veg.forEach(vegId => {
        const v = INGREDIENTS.veg.find(x => x.id === vegId);
        html += `<p class="builder-summary__item">+ <strong>${v.name}</strong></p>`;
      });

      if (state.sauce) {
        const s = INGREDIENTS.sauces.find(x => x.id === state.sauce);
        html += `<p class="builder-summary__item">+ <strong>${s.name}</strong> sauce</p>`;
      }

      summaryItems.innerHTML = html || '<p style="color: var(--muted);">Select items to build your meal...</p>';
    }

    // Update macros
    const macros = calculateMacros();
    document.querySelectorAll('.builder-summary__macro-value').forEach((el, i) => {
      const keys = ['kcal', 'protein', 'carbs', 'fat'];
      const value = macros[keys[i]];
      el.textContent = keys[i] === 'kcal' ? value : `${value}g`;
    });

    // Update price
    const price = calculatePrice();
    const priceEl = document.querySelector('.builder-summary__price-value');
    if (priceEl) priceEl.textContent = `£${price.toFixed(2)}`;

    // Update button
    const addBtn = document.querySelector('.builder-summary__add-btn');
    if (addBtn) {
      addBtn.disabled = !isComplete();
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Protein selection
    document.querySelectorAll('input[name="protein"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.protein = e.target.value;
        renderStep1();
        setupPortionListeners();
        setupEventListeners();
        updateSummary();
      });
    });

    // Carb selection
    document.querySelectorAll('input[name="carb"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.carb = e.target.value;
        updateSummary();
      });
    });

    // Veg selection
    document.querySelectorAll('input[name="veg"]').forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.checked && state.veg.length >= 2) {
          e.target.checked = false;
          return;
        }
        if (e.target.checked) {
          state.veg.push(e.target.value);
        } else {
          state.veg = state.veg.filter(v => v !== e.target.value);
        }
        updateSummary();
      });
    });

    // Sauce selection
    document.querySelectorAll('input[name="sauce"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.sauce = e.target.value;
        updateSummary();
      });
    });

    // Add to basket
    const addBtn = document.querySelector('.builder-summary__add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!isComplete()) return;

        const macros = calculateMacros();
        const price = calculatePrice();
        const name = 'My Custom Meal';

        MealPrepBasket.addToBasket({
          id: `custom_${Date.now()}`,
          name: name,
          price: price,
          bundle: 'custom',
          quantity: 1,
          macros: macros,
          custom: {
            protein: state.protein,
            proteinPortion: state.proteinPortion,
            carb: state.carb,
            veg: [...state.veg],
            sauce: state.sauce
          }
        });

        const originalText = addBtn.textContent;
        addBtn.textContent = '✓ Added to Basket';
        addBtn.disabled = true;
        setTimeout(() => {
          addBtn.textContent = originalText;
          addBtn.disabled = false;
        }, 1500);
      });
    }
  }

  /**
   * Setup portion listeners
   */
  function setupPortionListeners() {
    document.querySelectorAll('.portion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const portion = parseInt(btn.dataset.portion);
        state.proteinPortion = portion;
        document.querySelectorAll('.portion-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        updateSummary();
      });
    });
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
  function init() {
    renderStep1();
    renderStep2();
    renderStep3();
    renderStep4();
    setupEventListeners();
    setupPortionListeners();
    updateSummary();
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, calculateMacros, calculatePrice };
})();
