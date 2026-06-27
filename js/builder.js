/* =========================================================
   MEAL BUILDER MODULE
   Build-your-own meal with live macros and pricing
   ========================================================= */

const MealBuilder = (() => {
  'use strict';

  // Ingredient macros, pricing, allergens & kitchen portions now live in the
  // shared single-source file js/builder-data.js (window.BUILDER_INGREDIENTS),
  // so the customer builder and the admin order view never drift apart.
  // (Fallback to an empty shape if that script failed to load.)
  const INGREDIENTS = window.BUILDER_INGREDIENTS || { proteins: [], carbs: [], veg: [], sauces: [] };

  // Allergen display labels (mirrors the keys in js/allergens.js).
  const ALLERGEN_LABELS = {
    dairy: 'Dairy / Milk', gluten: 'Gluten', eggs: 'Eggs', fish: 'Fish',
    crustaceans: 'Crustaceans', molluscs: 'Molluscs', nuts: 'Tree nuts',
    peanuts: 'Peanuts', sesame: 'Sesame', soy: 'Soy', celery: 'Celery',
    mustard: 'Mustard', sulphites: 'Sulphites', lupin: 'Lupin'
  };

  // Every allergen key. Until ingredients are delivered and allergen-checked,
  // custom meals declare "may contain" ALL of these (shared-kitchen / not-yet-
  // verified caution). Tighten this once stock is purged and triple-checked.
  const ALL_ALLERGEN_KEYS = Object.keys(ALLERGEN_LABELS);

  // Small "Keto" badge shown on keto-friendly options
  function ketoBadge(item) {
    return item.keto ? '<span class="builder-option__keto">Keto</span>' : '';
  }

  /**
   * Collect the de-duplicated allergen keys across everything currently
   * selected (protein + carb + veg + sauce).
   */
  function collectAllergens() {
    const set = new Set();
    const add = (item) => { (item?.allergens || []).forEach(a => set.add(a)); };

    if (state.protein) add(INGREDIENTS.proteins.find(p => p.id === state.protein));
    if (state.carb)    add(INGREDIENTS.carbs.find(c => c.id === state.carb));
    state.veg.forEach(id => add(INGREDIENTS.veg.find(v => v.id === id)));
    if (state.sauce)   add(INGREDIENTS.sauces.find(s => s.id === state.sauce));

    return Array.from(set);
  }

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
    // Veg is optional — customers can pick none, one, or up to two.
    return state.protein && state.carb && state.sauce;
  }

  /**
   * Human-readable list of what's still needed before the meal can be
   * added to the basket. Drives the hint under the Add button so customers
   * are never stuck wondering why it's greyed out.
   */
  function missingSteps() {
    const missing = [];
    if (!state.protein) missing.push('a protein');
    if (!state.carb) missing.push('a carb base');
    // Veg is optional, so it's never a blocker.
    if (!state.sauce) missing.push('a sauce');
    return missing;
  }

  /**
   * Render protein step
   */
  function renderStep1() {
    const container = document.getElementById('step-1-options');
    if (!container) return;

    // Render the protein options (and, under the selected one, the portion
    // selector) INTO #step-1-options. Earlier this overwrote the parent
    // .builder-step, which destroyed the step heading and #step-1-options
    // itself — after which this function early-returned forever and the
    // portion selector never appeared.
    const selected = state.protein
      ? INGREDIENTS.proteins.find(p => p.id === state.protein)
      : null;

    container.innerHTML = `
      ${INGREDIENTS.proteins.map(protein => `
        <label class="builder-option ${state.protein === protein.id ? 'is-selected' : ''}">
          <input type="radio" name="protein" value="${protein.id}" ${state.protein === protein.id ? 'checked' : ''} />
          <span class="builder-option__name">${escapeHtml(protein.name)}</span>
          <span class="builder-option__price">From £${protein.basePrice.toFixed(2)}</span>
          ${ketoBadge(protein)}
        </label>
      `).join('')}
      ${selected ? renderPortionSelector(selected) : ''}
    `;

    // Re-bind only the elements we just re-rendered. The old inputs are gone
    // with the innerHTML swap, so their listeners are discarded — no stacking.
    attachProteinListeners();
    setupPortionListeners();
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
          ${carb.priceModifier !== 0 ? `<span class="builder-option__price">${carb.priceModifier > 0 ? '+' : '−'}£${Math.abs(carb.priceModifier).toFixed(2)}</span>` : ''}
          ${ketoBadge(carb)}
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
          <span class="builder-option__info">(Up to 2)</span>
          ${ketoBadge(veg)}
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
          ${ketoBadge(sauce)}
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

      if (html) {
        const allergens = collectAllergens();
        if (allergens.length) {
          html += `<p class="builder-summary__allergens"><strong>⚠️ Contains:</strong> ${allergens.map(a => ALLERGEN_LABELS[a] || a).join(', ')}</p>`;
        }
        html += `<p class="builder-summary__allergens-note"><strong>May contain any of the 14 major allergens.</strong> Our ingredients are not yet allergen-verified and all meals are made in a shared kitchen. If you have an allergy, please ask before ordering.</p>`;
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

    // Update button + "what's still needed" hint
    const addBtn = document.querySelector('.builder-summary__add-btn');
    if (addBtn) {
      const done = isComplete();
      addBtn.disabled = !done;
      addBtn.textContent = done ? `Add to Basket · £${price.toFixed(2)}` : 'Add to Basket';

      // Hint element lives right after the button (created once).
      let hint = document.querySelector('.builder-summary__needed');
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'builder-summary__needed';
        addBtn.insertAdjacentElement('afterend', hint);
      }
      const missing = missingSteps();
      if (done) {
        hint.textContent = '';
        hint.hidden = true;
      } else {
        hint.textContent = `Still to choose: ${missing.join(', ')}`;
        hint.hidden = false;
      }
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Protein listeners are (re)bound by renderStep1 each time it re-renders.
    attachProteinListeners();

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
          // Allergens carried on the item so the basket can warn even though
          // a custom meal has no Supabase meal_id to look up. "May contain"
          // blankets all 14 until ingredients are delivered and verified.
          allergens_contains: collectAllergens(),
          allergens_may_contain: ALL_ALLERGEN_KEYS,
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
   * Bind change listeners to the protein radios. Called on init and again
   * after every renderStep1() re-render (the radios are recreated each time).
   */
  function attachProteinListeners() {
    document.querySelectorAll('input[name="protein"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.protein = e.target.value;
        renderStep1();
        updateSummary();
      });
    });
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
