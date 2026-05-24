/* =========================================================
   MEAL PREP BASKET MODULE
   Manages localStorage-based shopping basket
   ========================================================= */

const MealPrepBasket = (() => {
  'use strict';

  const STORAGE_KEY = 'dd_basket';

  /**
   * Get current basket from localStorage
   */
  function getBasket() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load basket:', e);
      return [];
    }
  }

  /**
   * Save basket to localStorage
   */
  function saveBasket(basket) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
      updateBasketCounter();
      document.dispatchEvent(new CustomEvent('basket-updated', { detail: basket }));
    } catch (e) {
      console.error('Failed to save basket:', e);
    }
  }

  /**
   * Add item to basket
   * @param {Object} item - { id, name, price, quantity, bundle?, macros?, ... }
   */
  function addToBasket(item) {
    const basket = getBasket();
    
    // Create a unique key for the item (same item with different bundles = different entries)
    const itemKey = `${item.id}_${item.bundle || 'single'}_${item.portion || 'default'}`;
    
    // Check if item already exists
    const existing = basket.find(b => b.key === itemKey);
    
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      basket.push({
        ...item,
        key: itemKey,
        added_at: new Date().toISOString()
      });
    }
    
    saveBasket(basket);
    return basket;
  }

  /**
   * Remove item from basket by key
   */
  function removeFromBasket(itemKey) {
    let basket = getBasket();
    basket = basket.filter(item => item.key !== itemKey);
    saveBasket(basket);
    return basket;
  }

  /**
   * Update item quantity
   */
  function updateQuantity(itemKey, quantity) {
    if (quantity <= 0) {
      return removeFromBasket(itemKey);
    }
    
    const basket = getBasket();
    const item = basket.find(b => b.key === itemKey);
    
    if (item) {
      item.quantity = quantity;
      saveBasket(basket);
    }
    
    return basket;
  }

  /**
   * Clear entire basket
   */
  function clearBasket() {
    localStorage.removeItem(STORAGE_KEY);
    updateBasketCounter();
    document.dispatchEvent(new CustomEvent('basket-updated', { detail: [] }));
  }

  /**
   * Get basket item count
   */
  function getBasketCount() {
    const basket = getBasket();
    return basket.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  /**
   * Get basket total price
   */
  function getBasketTotal() {
    const basket = getBasket();
    return basket.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = item.quantity || 1;
      return sum + (price * qty);
    }, 0);
  }

  /**
   * Update the basket counter in nav
   */
  function updateBasketCounter() {
    const count = getBasketCount();
    const counters = document.querySelectorAll('.basket-counter');
    
    counters.forEach(counter => {
      const badge = counter.querySelector('.basket-counter__badge');
      
      if (badge) {
        badge.textContent = count;
      }
      
      // Update aria label for accessibility
      counter.setAttribute('aria-label', `Shopping basket with ${count} item${count !== 1 ? 's' : ''}`);
    });
  }

  /**
   * Initialize basket counter on page load
   */
  function init() {
    updateBasketCounter();
    
    // Listen for storage changes in other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        updateBasketCounter();
        document.dispatchEvent(new CustomEvent('basket-updated', { 
          detail: e.newValue ? JSON.parse(e.newValue) : [] 
        }));
      }
    });
  }

  // Auto-init on script load if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    getBasket,
    addToBasket,
    removeFromBasket,
    updateQuantity,
    clearBasket,
    getBasketCount,
    getBasketTotal,
    updateBasketCounter
  };
})();

// Expose on window so ES modules (menu.js, meal.js, etc.) can reach it.
window.MealPrepBasket = MealPrepBasket;
