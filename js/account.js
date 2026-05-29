// =========================================================
// ACCOUNT PAGE
// Three tabs: Orders, Subscriptions, Profile.
// Requires auth — redirects to login.html if not signed in.
// =========================================================

import { supabase } from './supabase.js';
import { requireAuth, getCurrentProfile, signOut } from './auth.js';
import { toast } from './toast.js';
import { ALLERGENS } from './allergens.js';

const basket = window.MealPrepBasket;

// ---------- BOOT ----------

const session = await requireAuth({ redirectTo: 'login.html' });
if (!session) {
  // requireAuth already redirected; bail out.
  throw new Error('not authenticated');
}

const userId = session.user.id;

// Show user's name in the hero
const profile = await getCurrentProfile();
const greetingEl = document.getElementById('account-greeting');
if (greetingEl) {
  const name = profile?.full_name?.trim() || session.user.email?.split('@')[0] || 'there';
  greetingEl.textContent = name;
}

// Load orders + subscriptions in parallel
const [orders, subscriptions] = await Promise.all([
  loadOrders(),
  loadSubscriptions()
]);

renderOrders(orders);
renderSubscriptions(subscriptions);
renderProfile(profile, session.user);
setupTabs();
setupProfileForm();
setupPasswordChange();
setupDeleteAccount();
setupSignOut();

// ---------- LOADERS ----------

async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[account] orders', error);
    toast('Could not load your orders.', 'error');
    return [];
  }
  return data || [];
}

async function loadSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[account] subscriptions', error);
    toast('Could not load your subscriptions.', 'error');
    return [];
  }
  return data || [];
}

// ---------- RENDER: ORDERS ----------

function renderOrders(rows) {
  const list = document.getElementById('orders-list');
  const empty = document.getElementById('orders-empty');
  if (!list || !empty) return;

  if (rows.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = rows.map((order) => orderCardHtml(order)).join('');

  // Reorder buttons
  list.querySelectorAll('[data-reorder]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reorder;
      const order = rows.find((o) => o.id === id);
      if (order) reorder(order);
    });
  });
}

function orderCardHtml(order) {
  const created = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      })
    : '—';
  const collection = order.collection_slot
    ? new Date(order.collection_slot).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
    : 'To be confirmed';

  const items = (order.order_items || []).map((it) => `
    <li>
      <span><strong>${escapeHtml(it.meal_name)}</strong> <small style="color: var(--muted);">${escapeHtml(bundleLabel(it.bundle_type))} · ×${it.quantity}</small></span>
      <span>£${parseFloat(it.line_total).toFixed(2)}</span>
    </li>
  `).join('');

  // Compute order-level macros total
  let totalMacros = null;
  if (order.order_items?.length) {
    const m = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    order.order_items.forEach((it) => {
      if (it.macros) {
        m.kcal    += (it.macros.kcal    || 0) * it.quantity;
        m.protein += (it.macros.protein || 0) * it.quantity;
        m.carbs   += (it.macros.carbs   || 0) * it.quantity;
        m.fat     += (it.macros.fat     || 0) * it.quantity;
      }
    });
    if (m.kcal > 0) totalMacros = m;
  }

  return `
    <article class="order-card" data-id="${escapeHtml(order.id)}">
      <div class="order-card__head">
        <span class="order-card__num">${escapeHtml(order.order_number)}</span>
        <span class="status-badge status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <p class="order-card__date">Ordered ${escapeHtml(created)}</p>
      <dl class="order-card__meta">
        <div><dt>Collection</dt><dd>${escapeHtml(collection)}</dd></div>
        <div><dt>Items</dt><dd>${(order.order_items || []).length}</dd></div>
        <div><dt>Total</dt><dd>£${parseFloat(order.total).toFixed(2)}</dd></div>
        <div><dt>Payment</dt><dd>${escapeHtml(order.payment_status)}</dd></div>
      </dl>
      <details class="order-card__details">
        <summary>View details</summary>
        <ul class="order-card__items">${items}</ul>
        ${totalMacros ? `<p class="order-card__macros">Total macros: ${Math.round(totalMacros.kcal)} kcal · ${Math.round(totalMacros.protein)}g protein · ${Math.round(totalMacros.carbs)}g carbs · ${Math.round(totalMacros.fat)}g fat</p>` : ''}
        ${order.notes ? `<p class="order-card__macros"><strong style="color:var(--gold);">Your notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
        <div class="order-card__actions">
          <button class="btn btn--sm" data-reorder="${escapeHtml(order.id)}">Reorder</button>
        </div>
      </details>
    </article>
  `;
}

async function reorder(order) {
  if (!basket || !order.order_items) return;
  order.order_items.forEach((it) => {
    basket.addToBasket({
      id: it.meal_id || `restored_${it.id}`,
      meal_id: it.meal_id || null,
      name: it.meal_name,
      price: parseFloat(it.unit_price),
      bundle: it.bundle_type,
      quantity: it.quantity,
      macros: it.macros,
      custom: it.build_details || undefined
    });
  });
  toast(`Added ${order.order_items.length} item${order.order_items.length === 1 ? '' : 's'} to your basket.`, 'success');
  setTimeout(() => { window.location.href = 'basket.html'; }, 800);
}

// ---------- RENDER: SUBSCRIPTIONS ----------

function renderSubscriptions(rows) {
  const list = document.getElementById('subs-list');
  const empty = document.getElementById('subs-empty');
  if (!list || !empty) return;

  if (rows.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = rows.map((sub) => subCardHtml(sub)).join('');

  list.querySelectorAll('[data-sub-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleSubAction(btn));
  });
}

function subCardHtml(sub) {
  const planLabel = {
    set_and_forget: 'Set & Forget',
    surprise_me:    'Surprise Me',
    custom:         'Custom'
  }[sub.plan_type] || sub.plan_type;

  const nextRenewal = sub.next_renewal
    ? new Date(sub.next_renewal).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const pausedUntil = sub.paused_until
    ? new Date(sub.paused_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const actions = sub.status === 'active' ? `
    <button class="btn btn--outline btn--sm" data-sub-action="pause" data-id="${escapeHtml(sub.id)}">Pause</button>
    <a class="btn btn--outline btn--sm" href="subscriptions.html?edit=${encodeURIComponent(sub.id)}">Edit Meals</a>
    <button class="btn btn--danger btn--sm" data-sub-action="cancel" data-id="${escapeHtml(sub.id)}">Cancel</button>
  ` : sub.status === 'paused' ? `
    <button class="btn btn--sm" data-sub-action="resume" data-id="${escapeHtml(sub.id)}">Resume</button>
    <button class="btn btn--danger btn--sm" data-sub-action="cancel" data-id="${escapeHtml(sub.id)}">Cancel</button>
  ` : '';

  return `
    <article class="sub-card" data-id="${escapeHtml(sub.id)}">
      <div class="sub-card__head">
        <h3 class="sub-card__plan">${escapeHtml(planLabel)}</h3>
        <span class="status-badge status-${escapeHtml(sub.status)}">${escapeHtml(sub.status)}</span>
      </div>
      <dl class="sub-card__meta">
        <div><dt>Meals / week</dt><dd>${sub.meals_per_week}</dd></div>
        <div><dt>Collection</dt><dd>${escapeHtml(sub.collection_day || '—')}${sub.collection_time ? ` ${escapeHtml(sub.collection_time)}` : ''}</dd></div>
        <div><dt>Next renewal</dt><dd>${escapeHtml(nextRenewal)}</dd></div>
        ${pausedUntil ? `<div><dt>Paused until</dt><dd>${escapeHtml(pausedUntil)}</dd></div>` : ''}
        <div><dt>Discount</dt><dd>${sub.discount_percent}%</dd></div>
      </dl>
      <div class="sub-card__actions">${actions}</div>
    </article>
  `;
}

async function handleSubAction(btn) {
  const id = btn.dataset.id;
  const action = btn.dataset.subAction;

  if (action === 'pause') {
    const dateStr = window.prompt('Paused until (YYYY-MM-DD). Leave blank to pause indefinitely:', '');
    const updates = { status: 'paused' };
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) updates.paused_until = dateStr;
    await updateSub(id, updates, 'Subscription paused.');
  } else if (action === 'resume') {
    await updateSub(id, { status: 'active', paused_until: null }, 'Subscription resumed.');
  } else if (action === 'cancel') {
    if (!confirm('Cancel this subscription? This stops all future deliveries. You can start a new one anytime.')) return;
    await updateSub(id, { status: 'cancelled' }, 'Subscription cancelled.');
  }
}

async function updateSub(id, updates, successMsg) {
  const { error } = await supabase.from('subscriptions').update(updates).eq('id', id);
  if (error) {
    toast(error.message || 'Could not update subscription.', 'error');
    return;
  }
  toast(successMsg, 'success');
  const refreshed = await loadSubscriptions();
  renderSubscriptions(refreshed);
}

// ---------- RENDER: PROFILE ----------

function renderProfile(profile, user) {
  const form = document.getElementById('profile-form');
  if (!form) return;
  form.fullName.value = profile?.full_name || '';
  form.email.value    = profile?.email || user.email || '';
  form.phone.value    = profile?.phone || '';
  // Email is managed by Supabase auth; show but disable for now
  form.email.disabled = true;

  // Render allergen checkboxes
  const grid = document.getElementById('allergen-grid');
  if (grid) {
    const have = new Set(profile?.allergens || []);
    grid.innerHTML = ALLERGENS.map((a) => `
      <label>
        <input type="checkbox" name="allergen" value="${a.key}" ${have.has(a.key) ? 'checked' : ''} />
        <span>${a.label}</span>
      </label>
    `).join('');
  }
}

function setupProfileForm() {
  const form = document.getElementById('profile-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const allergens = Array.from(
      form.querySelectorAll('input[name="allergen"]:checked')
    ).map((cb) => cb.value);
    const updates = {
      full_name: form.fullName.value.trim() || null,
      phone:     form.phone.value.trim() || null,
      allergens: allergens
    };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) {
      toast(error.message || 'Could not save profile.', 'error');
      return;
    }
    toast('Profile saved.', 'success');
  });
}

// ---------- PASSWORD CHANGE ----------

function setupPasswordChange() {
  const btn = document.getElementById('change-password-btn');
  btn?.addEventListener('click', async () => {
    const next = window.prompt('Enter a new password (at least 6 characters):');
    if (next == null) return;
    if (next.length < 6) {
      toast('Password must be at least 6 characters.', 'error');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      toast(error.message || 'Could not change password.', 'error');
      return;
    }
    toast('Password changed.', 'success');
  });
}

// ---------- DELETE ACCOUNT ----------
//
// Supabase doesn't let the anon role delete auth.users. For now we sign
// the user out and ask them to email the deli to finish the deletion.
// A proper implementation later: an Edge Function with the service-role
// key that deletes auth.users + the profile + cascades.

function setupDeleteAccount() {
  const btn = document.getElementById('delete-account-btn');
  btn?.addEventListener('click', async () => {
    if (!confirm(
      'Delete your account?\n\n' +
      'This signs you out now. We\'ll fully remove your data within 7 days. ' +
      'If you change your mind, sign back in within that time.'
    )) return;
    await signOut();
    toast('Signed out. Email hello@thedelidepot.com to finish deletion.', 'info', 8000);
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  });
}

// ---------- SIGN OUT ----------

function setupSignOut() {
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });
}

// ---------- TABS ----------

function setupTabs() {
  const tabs = document.querySelectorAll('.account-tab');
  const panels = document.querySelectorAll('.account-panel');

  // Honour ?tab= for deep links (e.g. from order-confirmation)
  const wanted = new URLSearchParams(window.location.search).get('tab');
  if (wanted) {
    const t = Array.from(tabs).find((x) => x.dataset.tab === wanted);
    if (t) t.click();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      panels.forEach((p) => { p.hidden = p.dataset.panel !== target; });
    });
  });
}

// ---------- HELPERS ----------

function bundleLabel(b) {
  switch (b) {
    case 'single':         return 'Single';
    case 'bundle_5':       return '5 Pack';
    case 'bundle_10':      return '10 Pack';
    case 'build_your_own': return 'Build Your Own';
    default:               return b || 'Single';
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
