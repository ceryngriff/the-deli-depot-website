// =========================================================
// CHECKOUT
// Collection slot picker + contact form + order creation.
// Supports both signed-in users and guest checkout.
//
// Payment flow: place_order() inserts the order as 'unpaid', then we
// create a Stripe PaymentIntent and confirm the card via Stripe Elements
// before redirecting to the confirmation page. The stripe-webhook Netlify
// Function flips the order to 'paid' server-side.
// =========================================================

import { supabase } from './supabase.js';
import { getSession, getCurrentProfile } from './auth.js';

const basket = window.MealPrepBasket;

// ---------- DEFAULT TIME SLOTS ----------
// Spec gave 8am / 12pm / 5pm / 7pm. Deli closes at 15:00 weekdays,
// so the late slots assume meal-prep collections run outside trading
// hours — Ceryn can adjust this list to suit.
const TIME_SLOTS = [
  { value: '08:00', label: '8:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '17:00', label: '5:00 PM' }
];

// ---------- COLLECTION DATE LOGIC ----------

const CUTOFF_HOUR = 17; // 5pm

// Returns the earliest collection date (YYYY-MM-DD) given current time.
// Rule: order by 5pm for next-day collection. After 5pm → day after tomorrow.
// Open 7 days a week, so no days are skipped.
function getEarliestCollectionDate() {
  const now = new Date();
  let earliest = new Date(now);
  earliest.setHours(0, 0, 0, 0);
  if (now.getHours() >= CUTOFF_HOUR) earliest.setDate(earliest.getDate() + 2);
  else earliest.setDate(earliest.getDate() + 1);
  return earliest;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function combineDateTime(dateStr, timeStr) {
  // Build a Date in the user's local zone, then convert to ISO for the DB.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// ---------- BUNDLE MAPPING ----------

function toBundleType(b) {
  switch (b) {
    case 'single':         return 'single';
    case '5':
    case 'bundle_5':       return 'bundle_5';
    case '10':
    case 'bundle_10':      return 'bundle_10';
    case 'custom':
    case 'build_your_own': return 'build_your_own';
    default:               return 'single';
  }
}

// ---------- FORM HELPERS ----------

function showError(msg) {
  const box = document.getElementById('checkout-error');
  if (!box) return;
  box.textContent = msg;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideError() {
  const box = document.getElementById('checkout-error');
  if (box) box.hidden = true;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- RENDER ORDER SUMMARY ----------

function renderSummary() {
  const list = document.getElementById('summary-items');
  const subEl = document.getElementById('summary-subtotal');
  const totEl = document.getElementById('summary-total');
  if (!list) return;

  const items = basket.getBasket();
  if (items.length === 0) {
    // Redirect back if the basket got emptied
    window.location.replace('basket.html');
    return;
  }

  list.innerHTML = items.map((item) => `
    <li>
      <span>${escapeHtml(item.name)} <small style="color: var(--muted);">×${item.quantity}</small></span>
      <strong>£${(item.price * item.quantity).toFixed(2)}</strong>
    </li>
  `).join('');

  const sub = basket.getBasketTotal();
  if (subEl) subEl.textContent = `£${sub.toFixed(2)}`;
  if (totEl) totEl.textContent = `£${sub.toFixed(2)}`;
}

// ---------- PRE-FILL CONTACT FIELDS ----------

async function prefillContact() {
  const session = await getSession();
  const guestBanner = document.getElementById('guest-banner');

  if (!session) {
    if (guestBanner) guestBanner.hidden = false;
    // Add ?redirect=checkout.html to the sign-in link
    document.querySelectorAll('[data-guest-signin]').forEach((a) => {
      a.setAttribute('href', 'login.html?redirect=checkout.html');
    });
    return;
  }

  // Signed in — pre-fill from profile
  if (guestBanner) guestBanner.hidden = true;
  const profile = await getCurrentProfile();
  const form = document.getElementById('checkout-form');
  if (!form || !profile) return;

  if (form.fullName  && !form.fullName.value)  form.fullName.value  = profile.full_name || '';
  if (form.email     && !form.email.value)     form.email.value     = profile.email || session.user.email || '';
  if (form.phone     && !form.phone.value)     form.phone.value     = profile.phone || '';
}

// ---------- SETUP DATE PICKER ----------

async function setupDatePicker() {
  const dateInput = document.getElementById('collection-date');
  const timeSelect = document.getElementById('collection-time');
  if (!dateInput || !timeSelect) return;

  const earliest = getEarliestCollectionDate();
  dateInput.min = toISODate(earliest);
  dateInput.value = toISODate(earliest);

  await refreshTimeSlots(dateInput.value);

  dateInput.addEventListener('change', async () => {
    await refreshTimeSlots(dateInput.value);
  });
}

// Query slot_availability RPC and render the time dropdown with
// "X left" / "(full)" annotations. Slots that are full are disabled.
async function refreshTimeSlots(dateStr) {
  const timeSelect = document.getElementById('collection-time');
  if (!timeSelect) return;
  const prevValue = timeSelect.value;

  // Render the plain slots first so the dropdown is NEVER empty — even if
  // the availability lookup throws (e.g. Supabase unreachable / misconfigured).
  timeSelect.innerHTML = TIME_SLOTS
    .map((s) => `<option value="${s.value}">${escapeHtml(s.label)}</option>`)
    .join('');

  let data, error;
  try {
        const rpcPromise = supabase.rpc('slot_availability', { p_date: dateStr });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        ({ data, error } = await Promise.race([rpcPromise, timeout]));
  } catch (e) {
    error = e; // a thrown rejection (network failure) — treat like a returned error
  }
  if (error) {
    console.warn('[checkout] slot_availability unavailable — showing all slots', error);
    return; // base slots already rendered above
  }

  const availMap = new Map((data || []).map((a) => [a.time_slot, a]));

  timeSelect.innerHTML = TIME_SLOTS.map((s) => {
    const a = availMap.get(s.value);
    if (!a) {
      // No cap configured for this slot — leave it open
      return `<option value="${s.value}">${escapeHtml(s.label)}</option>`;
    }
    const remaining = Math.max(0, a.max_orders - a.used);
    const full = remaining === 0;
    const label = full
      ? `${s.label} — full`
      : `${s.label} — ${remaining} left`;
    return `<option value="${s.value}" ${full ? 'disabled' : ''}>${escapeHtml(label)}</option>`;
  }).join('');

  // Restore previous selection if it's still valid; otherwise pick the
  // first non-disabled option.
  const stillValid = Array.from(timeSelect.options)
    .find((o) => o.value === prevValue && !o.disabled);
  if (stillValid) {
    timeSelect.value = prevValue;
  } else {
    const firstOpen = Array.from(timeSelect.options).find((o) => !o.disabled);
    if (firstOpen) timeSelect.value = firstOpen.value;
  }
}

// Reject if a promise doesn't settle within `ms`, so a hung network request
// (e.g. Supabase unreachable) can't leave the button stuck on "Placing order…".
function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    )
  ]);
}

// ---------- STRIPE PAYMENT ----------
// Card payments run AFTER the order row exists: place_order() inserts the
// order as 'unpaid', then we create a Stripe PaymentIntent and confirm the
// card here in the browser. The stripe-webhook Netlify Function is what
// actually flips the order to 'paid' server-side — never trust the client.

// State carried between the two clicks of the submit button:
//   1st click → create order + PaymentIntent, reveal the card form
//   2nd click → confirm the card payment
let createdOrder   = null; // { order, itemRows, cachedOrder, subtotal } once place_order succeeds
let pendingPayment = null; // { clientSecret } once the PaymentIntent + card form are ready
let stripeInstance = null; // cached Stripe(pk) object
let cardElement    = null; // mounted Stripe Elements card

// Dark deli theme for Stripe Elements (cream/gold on near-black).
const STRIPE_APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary:         '#c9a961',
    colorBackground:      '#141312',
    colorText:            '#f5f1e8',
    colorTextSecondary:   '#a8a39a',
    colorTextPlaceholder: '#6f6a62',
    colorDanger:          '#f4b3a8',
    fontFamily:           'Montserrat, system-ui, sans-serif',
    borderRadius:         '8px'
  }
};
// The combined `card` Element styles its text via the classic `style` option.
const STRIPE_CARD_STYLE = {
  base: {
    color:        '#f5f1e8',
    fontFamily:   'Montserrat, system-ui, sans-serif',
    fontSize:     '16px',
    iconColor:    '#c9a961',
    '::placeholder': { color: '#6f6a62' }
  },
  invalid: { color: '#f4b3a8', iconColor: '#f4b3a8' }
};

// Returns the configured publishable key, or null if it's missing/placeholder.
function getStripeKey() {
  const key = window.STRIPE_PUBLISHABLE_KEY;
  if (!key || key === 'pk_live_REPLACE_ME') return null;
  return key;
}

// Inject Stripe.js from the CDN once (no bundler here). Resolves when ready.
function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve();
    const existing = document.querySelector('script[data-stripe-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Stripe.js')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.dataset.stripeJs = 'true';
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Could not load Stripe.js'));
    document.head.appendChild(s);
  });
}

// Build the Stripe instance + card Element and mount it into the page (once).
async function mountCardElement(key) {
  await loadStripeJs();
  if (!stripeInstance) stripeInstance = window.Stripe(key);
  if (!cardElement) {
    const elements = stripeInstance.elements({ appearance: STRIPE_APPEARANCE });
    // hidePostalCode: collection-only service — we don't need a billing
    // postcode, and the field otherwise blocks customers who leave it blank.
    cardElement = elements.create('card', { style: STRIPE_CARD_STYLE, hidePostalCode: true });
    cardElement.mount('#stripe-card-element');
    // Surface inline validation errors as the customer types.
    const errBox = document.getElementById('stripe-card-errors');
    cardElement.on('change', (ev) => {
      if (errBox) errBox.textContent = ev.error ? ev.error.message : '';
    });
  }
}

// ---------- PLACE ORDER ----------

// Submit dispatcher: first press creates the order + card form, second press
// (once the card form is showing) confirms the payment. Guarding on
// pendingPayment is what prevents a duplicate order on the pay step.
async function placeOrder() {
  if (pendingPayment) {
    await confirmPayment();
  } else {
    await createOrderAndShowPayment();
  }
}

async function createOrderAndShowPayment() {
  hideError();
  const form = document.getElementById('checkout-form');
  if (!form) return;

  const items = basket.getBasket();
  if (items.length === 0) {
    showError('Your basket is empty.');
    return;
  }

  const fullName = form.fullName.value.trim();
  const email    = form.email.value.trim();
  const phone    = form.phone.value.trim();
  const notes    = form.notes.value.trim();
  const date     = form.collectionDate.value;
  const time     = form.collectionTime.value;

  if (!fullName || !email || !phone || !date || !time) {
    showError('Please fill in your name, email, phone, and collection slot.');
    return;
  }

  const collectionDateTime = combineDateTime(date, time);
  if (Number.isNaN(collectionDateTime.getTime())) {
    showError('That collection date/time looks wrong. Please re-pick.');
    return;
  }

  // Check card payments are configured BEFORE we create an order — otherwise
  // we'd leave an unpaid order that can never be settled.
  const stripeKey = getStripeKey();
  if (!stripeKey) {
    showError('Card payments aren\'t set up yet. Please contact the deli to place your order.');
    return;
  }

  // Re-check capacity at submit time (another customer could have filled
  // this slot while we were on the page). Fail OPEN: if the lookup throws or
  // times out (Supabase slow/unreachable), let the order through rather than
  // silently aborting — the DB still enforces the real cap on insert.
  let avail = null;
  try {
    const rpcPromise = supabase.rpc('slot_availability', { p_date: date });
    const timeout = new Promise((r) => setTimeout(() => r({ data: null }), 3000));
    ({ data: avail } = (await Promise.race([rpcPromise, timeout])) ?? { data: null });
  } catch (e) {
    console.warn('[checkout] capacity re-check unavailable — proceeding', e);
  }
  const thisSlot = (avail || []).find((a) => a.time_slot === time);
  if (thisSlot && thisSlot.used >= thisSlot.max_orders) {
    showError('Sorry — that slot just filled up while you were checking out. Please pick another time.');
    await refreshTimeSlots(date);
    return;
  }

  const subtotal = basket.getBasketTotal();

  const submitBtn = document.getElementById('place-order-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating order…';
  }

  // Build the line items for the order.
  const itemRows = items.map((item) => ({
    meal_id:       item.meal_id || null,
    meal_name:     item.name,
    bundle_type:   toBundleType(item.bundle),
    quantity:      item.quantity,
    unit_price:    parseFloat(item.price.toFixed(2)),
    line_total:    parseFloat((item.price * item.quantity).toFixed(2)),
    build_details: item.custom ? {
      protein:        item.custom.protein,
      proteinPortion: item.custom.proteinPortion,
      carb:           item.custom.carb,
      veg:            item.custom.veg,
      sauce:          item.custom.sauce
    } : null,
    macros: item.macros || null
  }));

  // 1. Create the order + items in one server-side call. This runs through
  // the place_order() database function (SECURITY DEFINER), which lets guests
  // (who have no auth identity) create their own order without tripping the
  // owner-scoped Row Level Security policies — and returns the new order
  // number so we don't need a separate, RLS-blocked read-back.
  //
  // Reuse an order from an earlier attempt (e.g. the PaymentIntent call failed
  // and the customer pressed the button again) so we never create duplicates.
  if (!createdOrder) {
    let order, orderErr;
    try {
      ({ data: order, error: orderErr } = await withTimeout(
        supabase.rpc('place_order', {
          p_email:          email,
          p_name:           fullName,
          p_phone:          phone,
          p_collection_slot: collectionDateTime.toISOString(),
          p_subtotal:       subtotal,
          p_total:          subtotal,
          p_notes:          notes || null,
          p_items:          itemRows
        }).single(),
        12000
      ));
    } catch (e) {
      orderErr = e; // timeout or network rejection
    }

    if (orderErr || !order) {
      console.error('[checkout] place_order', orderErr);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
      showError(`We couldn't place your order: ${orderErr?.message || 'Unknown error'}. Please try again.`);
      return;
    }

    // Cache the order details so the confirmation page can show them even for
    // guests (RLS won't let anon read their own orders back). Stays 'unpaid'
    // here — we re-stamp it 'paid' after the card is confirmed.
    const cachedOrder = {
      id:              order.id,
      order_number:    order.order_number,
      customer_name:   fullName,
      customer_email:  email,
      customer_phone:  phone,
      status:          'pending',
      collection_slot: collectionDateTime.toISOString(),
      subtotal:        subtotal,
      total:           subtotal,
      notes:           notes || null,
      payment_status:  'unpaid'
    };
    createdOrder = { order, itemRows, cachedOrder, subtotal, fullName, email };
  }

  // 2. Create the Stripe PaymentIntent for this order's total.
  const { order, cachedOrder } = createdOrder;
  let clientSecret;
  try {
    const resp = await withTimeout(fetch('/.netlify/functions/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId:       order.id,
        orderNumber:   order.order_number,
        amountPence:   Math.round(subtotal * 100),
        customerEmail: email,
        customerName:  fullName
      })
    }), 12000);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.clientSecret) {
      throw new Error(data.error || `Payment setup failed (${resp.status})`);
    }
    clientSecret = data.clientSecret;
  } catch (e) {
    console.error('[checkout] create-payment-intent', e);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
    showError(`We couldn't start the payment: ${e.message || 'Unknown error'}. Your order is saved — please try again.`);
    return;
  }

  // 3. Load Stripe.js + mount the card form, then reveal the payment section.
  try {
    await mountCardElement(stripeKey);
  } catch (e) {
    console.error('[checkout] Stripe.js / Elements', e);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
    showError('We couldn\'t load the secure card form. Please refresh and try again.');
    return;
  }

  const paySection = document.getElementById('stripe-payment-section');
  if (paySection) {
    paySection.hidden = false;
    paySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (cardElement) cardElement.focus();

  pendingPayment = { clientSecret };

  // Hand off to the pay step — the next button press confirms the card.
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = `Pay £${subtotal.toFixed(2)}`;
  }
}

// ---------- CONFIRM CARD PAYMENT ----------

async function confirmPayment() {
  hideError();
  if (!pendingPayment || !createdOrder || !cardElement || !stripeInstance) return;

  const { clientSecret } = pendingPayment;
  const { order, itemRows, cachedOrder, subtotal, fullName, email } = createdOrder;

  const submitBtn = document.getElementById('place-order-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing payment…';
  }

  let result;
  try {
    result = await stripeInstance.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { name: fullName, email }
      }
    });
  } catch (e) {
    result = { error: { message: e.message || 'Payment could not be processed.' } };
  }

  if (result.error) {
    // Payment failed — keep the order + PaymentIntent so the customer can
    // simply correct their card and try again (no duplicate order).
    const msg = result.error.message || 'Your card could not be charged.';
    const cardErr = document.getElementById('stripe-card-errors');
    if (cardErr) cardErr.textContent = msg;
    showError(msg);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = `Pay £${subtotal.toFixed(2)}`; }
    return;
  }

  // Payment succeeded. The stripe-webhook function will flip the order to
  // 'paid' server-side; update our cached copy so the confirmation page
  // reflects it immediately.
  cachedOrder.payment_status = 'paid';
  cachedOrder.status = 'confirmed';
  try {
    sessionStorage.setItem('dd_last_order', JSON.stringify({
      order: cachedOrder,
      items: itemRows,
      cachedAt: new Date().toISOString()
    }));
  } catch (e) { /* sessionStorage might be unavailable */ }

  // Fire-and-forget confirmation email (non-blocking). Endpoint only exists on
  // the Netlify-deployed site — locally this 404s and we log + move on.
  sendConfirmationEmail(cachedOrder, itemRows).catch((err) => {
    console.warn('[checkout] confirmation email did not send:', err);
  });

  // Empty the basket and redirect.
  basket.clearBasket();
  window.location.href = `order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;
}

async function sendConfirmationEmail(order, items) {
  const resp = await fetch('/.netlify/functions/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, items })
  });
  // We don't care about the result — order is already created.
  // The Netlify Function logs failures on its side.
  if (!resp.ok) {
    console.warn('[checkout] email function returned', resp.status);
  }
}

// ---------- INIT ----------

document.getElementById('checkout-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  placeOrder();
});

renderSummary();
prefillContact();
setupDatePicker();

// Signal to the inline guard in checkout.html that the real handler is live.
// Until this is set, tapping Place Order means the module (incl. the Supabase
// CDN import) hasn't finished loading — usually a slow/flaky connection.
window.__checkoutReady = true;
