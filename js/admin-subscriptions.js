// =========================================================
// ADMIN SUBSCRIPTIONS — table + detail view with
// pause/resume/cancel, collection slot edits, audit logging.
// =========================================================

import { adminProfile } from './admin-shared.js'; // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

const PLAN_LABELS = {
  set_and_forget: 'Set & Forget',
  surprise_me:    'Surprise Me',
  custom:         'Custom'
};

const COLLECTION_DAYS = [
  ['monday',    'Monday'],
  ['tuesday',   'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday',  'Thursday'],
  ['friday',    'Friday'],
  ['saturday',  'Saturday'],
  ['sunday',    'Sunday']
];

const TIME_SLOTS = [
  ['08:00', '8:00 AM'],
  ['12:00', '12:00 PM'],
  ['17:00', '5:00 PM']
];

let subscriptions = [];
let filtered = [];
let mealsById = new Map();
let viewing = null;

const state = {
  status: 'all',
  search: ''
};

// ---------- DOM REFS ----------

const els = {
  tabs:         document.getElementById('status-tabs'),
  search:       document.getElementById('search-input'),
  tbody:        document.getElementById('subs-tbody'),
  footerCount:  document.getElementById('subs-count'),

  modal:        document.getElementById('sub-modal'),
  modalTitle:   document.getElementById('sub-modal-title'),
  modalClose:   document.getElementById('sub-modal-close'),
  modalBody:    document.getElementById('sub-modal-body')
};

// ---------- URL PRESET ----------

(function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const s = p.get('status');
  if (s && ['all', 'active', 'paused', 'cancelled'].includes(s)) state.status = s;
})();

// ---------- LOAD ----------

async function loadData() {
  // Subscriptions joined with the customer's profile
  const subsP = supabase
    .from('subscriptions')
    .select(`
      *,
      profiles:customer_id (full_name, email, phone)
    `)
    .order('created_at', { ascending: false });

  // Meals once, so we can render selected meal names in detail view
  const mealsP = supabase
    .from('meals')
    .select('id, name, slug');

  const [{ data: subs, error: subsErr }, { data: meals, error: mealsErr }] =
    await Promise.all([subsP, mealsP]);

  if (subsErr) {
    toast('Could not load subscriptions.', 'error');
    return;
  }
  subscriptions = subs || [];

  if (!mealsErr && meals) {
    mealsById = new Map(meals.map((m) => [m.id, m]));
  }

  renderTabs();
  applyFilters();
}

// ---------- FILTERS ----------

function applyFilters() {
  filtered = subscriptions.filter((s) => {
    if (state.status !== 'all' && s.status !== state.status) return false;
    if (state.search) {
      const p = s.profiles || {};
      const hay = `${p.full_name || ''} ${p.email || ''} ${p.phone || ''} ${PLAN_LABELS[s.plan_type] || s.plan_type}`.toLowerCase();
      if (!hay.includes(state.search.toLowerCase())) return false;
    }
    return true;
  });
  renderTable();
}

// ---------- RENDER: TABS ----------

function renderTabs() {
  if (!els.tabs) return;
  const labels = [
    ['all',       'All'],
    ['active',    'Active'],
    ['paused',    'Paused'],
    ['cancelled', 'Cancelled']
  ];
  els.tabs.innerHTML = labels.map(([k, label]) => {
    const count = k === 'all'
      ? subscriptions.length
      : subscriptions.filter((s) => s.status === k).length;
    return `
      <button class="admin-tab ${state.status === k ? 'is-active' : ''}" data-tab="${k}">
        ${label}<span class="admin-tab__count">${count}</span>
      </button>
    `;
  }).join('');
  els.tabs.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.status = btn.dataset.tab;
      renderTabs();
      applyFilters();
    });
  });
}

// ---------- RENDER: TABLE ----------

function renderTable() {
  if (!els.tbody) return;
  if (filtered.length === 0) {
    els.tbody.innerHTML = `
      <tr><td colspan="7" class="admin-table__empty">No subscriptions match these filters.</td></tr>
    `;
    if (els.footerCount) els.footerCount.textContent = '';
    return;
  }
  els.tbody.innerHTML = filtered.map(rowHtml).join('');
  if (els.footerCount) {
    els.footerCount.textContent =
      `Showing ${filtered.length} of ${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'}`;
  }
  els.tbody.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.view));
  });
}

function rowHtml(s) {
  const p = s.profiles || {};
  const next = s.next_renewal
    ? new Date(s.next_renewal).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const day = COLLECTION_DAYS.find((d) => d[0] === s.collection_day)?.[1] || s.collection_day || '—';

  return `
    <tr>
      <td>
        <p class="admin-table__name">${escapeHtml(p.full_name || 'No name')}</p>
        <p class="admin-table__slug">${escapeHtml(p.email || '')}</p>
      </td>
      <td>${escapeHtml(PLAN_LABELS[s.plan_type] || s.plan_type)}</td>
      <td>${s.meals_per_week}</td>
      <td>${escapeHtml(day)} ${escapeHtml(s.collection_time || '')}</td>
      <td style="font-size: 0.85rem;">${escapeHtml(next)}</td>
      <td><span class="status-badge status-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
      <td class="admin-table__actions">
        <button class="btn btn--outline" data-view="${escapeHtml(s.id)}">View</button>
      </td>
    </tr>
  `;
}

// ---------- DETAIL MODAL ----------

async function openModal(id) {
  viewing = subscriptions.find((s) => s.id === id);
  if (!viewing) return;
  els.modalTitle.textContent = `Subscription · ${PLAN_LABELS[viewing.plan_type] || viewing.plan_type}`;
  await renderDetail();
  els.modal.showModal();
}
function closeModal() {
  if (els.modal.open) els.modal.close();
  viewing = null;
}

async function renderDetail() {
  if (!viewing || !els.modalBody) return;
  const s = viewing;
  const p = s.profiles || {};

  const created = new Date(s.created_at).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' });
  const pausedUntil = s.paused_until
    ? new Date(s.paused_until).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const next = s.next_renewal
    ? new Date(s.next_renewal).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const selectedMeals = (s.selected_meal_ids || [])
    .map((id) => mealsById.get(id))
    .filter(Boolean);

  // Recent orders from this customer (closest we can do without a
  // subscription_id link on orders — see TODO at bottom of file).
  let recentOrders = [];
  if (s.customer_id) {
    const { data } = await supabase
      .from('orders')
      .select('order_number, status, total, collection_slot, created_at')
      .eq('customer_id', s.customer_id)
      .order('created_at', { ascending: false })
      .limit(5);
    recentOrders = data || [];
  }

  els.modalBody.innerHTML = `
    <div class="order-detail">

      <div class="order-detail__head">
        <span class="order-detail__num">${escapeHtml(PLAN_LABELS[s.plan_type] || s.plan_type)}</span>
        <span class="order-detail__date">Created ${escapeHtml(created)}</span>
      </div>

      <section class="order-detail__section">
        <h3>Customer</h3>
        <dl class="order-detail__grid">
          <div><dt>Name</dt><dd>${escapeHtml(p.full_name || '—')}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(p.email || '—')}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(p.phone || '—')}</dd></div>
          <div><dt>Status</dt><dd><span class="status-badge status-${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></dd></div>
        </dl>
      </section>

      <section class="order-detail__section">
        <h3>Plan</h3>
        <div class="admin-form__row">
          <label class="admin-field">
            <span>Meals per week</span>
            <select id="meals-per-week">
              ${[3, 5, 7].map((n) => `
                <option value="${n}" ${n === s.meals_per_week ? 'selected' : ''}>${n}</option>
              `).join('')}
            </select>
          </label>
          <label class="admin-field">
            <span>Discount</span>
            <input type="text" value="${s.discount_percent}%" disabled />
          </label>
        </div>
        <div class="admin-form__row">
          <label class="admin-field">
            <span>Collection day</span>
            <select id="collection-day">
              ${COLLECTION_DAYS.map(([v, label]) => `
                <option value="${v}" ${v === s.collection_day ? 'selected' : ''}>${label}</option>
              `).join('')}
            </select>
          </label>
          <label class="admin-field">
            <span>Collection time</span>
            <select id="collection-time">
              ${TIME_SLOTS.map(([v, label]) => `
                <option value="${v}" ${v === s.collection_time ? 'selected' : ''}>${label}</option>
              `).join('')}
            </select>
          </label>
        </div>
        ${selectedMeals.length ? `
          <p style="margin: 1rem 0 0; font-size: 0.85rem; color: var(--cream-muted);">
            <strong style="color: var(--gold);">Meals:</strong>
            ${selectedMeals.map((m) => escapeHtml(m.name)).join(', ')}
          </p>
        ` : ''}
        ${pausedUntil ? `
          <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--cream-muted);">
            <strong style="color: var(--gold);">Paused until:</strong> ${escapeHtml(pausedUntil)}
          </p>
        ` : ''}
      </section>

      <section class="order-detail__section">
        <h3>Status &amp; Actions</h3>
        ${s.status === 'active' ? `
          <div class="admin-form__row">
            <label class="admin-field">
              <span>Pause until (optional)</span>
              <input type="date" id="pause-until" />
            </label>
            <div style="display: flex; align-items: flex-end;">
              <button id="pause-btn" class="btn btn--outline" style="width: 100%;">Pause Subscription</button>
            </div>
          </div>
        ` : ''}
        ${s.status === 'paused' ? `
          <button id="resume-btn" class="btn">Resume Subscription</button>
        ` : ''}
        <div class="order-detail__actions" style="margin-top: 1rem;">
          <button id="save-plan-btn" class="btn">Save Plan Changes</button>
          ${s.status !== 'cancelled' ? `
            <button id="cancel-sub-btn" class="btn btn--danger">Cancel Subscription</button>
          ` : ''}
        </div>
      </section>

      <section class="order-detail__section">
        <h3>Recent Orders from this Customer</h3>
        ${recentOrders.length === 0 ? `
          <p style="margin: 0; color: var(--cream-muted); font-size: 0.9rem;">No orders yet.</p>
        ` : `
          <ul class="order-line-items">
            ${recentOrders.map((o) => `
              <li>
                <div class="order-line-items__head">
                  <strong>${escapeHtml(o.order_number)}</strong>
                  <span>£${parseFloat(o.total).toFixed(2)}</span>
                </div>
                <p class="order-line-items__sub">
                  ${escapeHtml(new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}
                  · <span class="status-badge status-${escapeHtml(o.status)}" style="margin-left: 0.4rem;">${escapeHtml(o.status)}</span>
                </p>
              </li>
            `).join('')}
          </ul>
          <p style="margin: 0.8rem 0 0; font-size: 0.78rem; color: var(--muted);">
            Note: orders aren't currently linked to subscriptions in the database — these are simply the customer's recent orders.
          </p>
        `}
      </section>

    </div>
  `;

  document.getElementById('save-plan-btn')?.addEventListener('click', saveChanges);
  document.getElementById('pause-btn')?.addEventListener('click', pauseSub);
  document.getElementById('resume-btn')?.addEventListener('click', resumeSub);
  document.getElementById('cancel-sub-btn')?.addEventListener('click', cancelSub);
}

// ---------- ACTIONS ----------

async function saveChanges() {
  if (!viewing) return;
  const newMeals = parseInt(document.getElementById('meals-per-week').value, 10);
  const newDay   = document.getElementById('collection-day').value;
  const newTime  = document.getElementById('collection-time').value;

  const updates = {};
  const before = {};
  const after  = {};
  if (newMeals !== viewing.meals_per_week) {
    updates.meals_per_week = newMeals;
    before.meals_per_week = viewing.meals_per_week;
    after.meals_per_week  = newMeals;
  }
  if (newDay !== viewing.collection_day) {
    updates.collection_day = newDay;
    before.collection_day = viewing.collection_day;
    after.collection_day  = newDay;
  }
  if (newTime !== viewing.collection_time) {
    updates.collection_time = newTime;
    before.collection_time = viewing.collection_time;
    after.collection_time  = newTime;
  }
  if (Object.keys(updates).length === 0) {
    toast('Nothing changed.', 'info');
    return;
  }

  const btn = document.getElementById('save-plan-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await supabase.from('subscriptions').update(updates).eq('id', viewing.id);

  if (btn) { btn.disabled = false; btn.textContent = 'Save Plan Changes'; }
  if (error) {
    toast(error.message || 'Could not save.', 'error');
    return;
  }
  Object.assign(viewing, updates);
  await writeAudit('updated_subscription', viewing.id, before, after);
  toast('Subscription saved.', 'success');
  applyFilters();
  renderTabs();
  await renderDetail();
}

async function pauseSub() {
  if (!viewing) return;
  const dateEl = document.getElementById('pause-until');
  const updates = { status: 'paused' };
  if (dateEl?.value) updates.paused_until = dateEl.value;
  const before = { status: viewing.status, paused_until: viewing.paused_until };
  const after  = updates;

  const btn = document.getElementById('pause-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Pausing…'; }

  const { error } = await supabase.from('subscriptions').update(updates).eq('id', viewing.id);

  if (btn) { btn.disabled = false; btn.textContent = 'Pause Subscription'; }
  if (error) { toast(error.message, 'error'); return; }
  Object.assign(viewing, updates);
  await writeAudit('paused_subscription', viewing.id, before, after);
  toast('Subscription paused.', 'success');
  applyFilters();
  renderTabs();
  await renderDetail();
}

async function resumeSub() {
  if (!viewing) return;
  const updates = { status: 'active', paused_until: null };
  const before  = { status: viewing.status, paused_until: viewing.paused_until };
  const after   = updates;

  const { error } = await supabase.from('subscriptions').update(updates).eq('id', viewing.id);
  if (error) { toast(error.message, 'error'); return; }
  Object.assign(viewing, updates);
  await writeAudit('resumed_subscription', viewing.id, before, after);
  toast('Subscription resumed.', 'success');
  applyFilters();
  renderTabs();
  await renderDetail();
}

async function cancelSub() {
  if (!viewing) return;
  if (!confirm(
    `Cancel this subscription?\n\n` +
    `This stops all future deliveries. The customer can start a new one anytime.`
  )) return;

  const updates = { status: 'cancelled' };
  const before  = { status: viewing.status };
  const after   = updates;

  const { error } = await supabase.from('subscriptions').update(updates).eq('id', viewing.id);
  if (error) { toast(error.message, 'error'); return; }
  Object.assign(viewing, updates);
  await writeAudit('cancelled_subscription', viewing.id, before, after);
  toast('Subscription cancelled.', 'success');
  applyFilters();
  renderTabs();
  await renderDetail();
}

// ---------- AUDIT LOG ----------

async function writeAudit(action, entityId, before, after) {
  if (!adminProfile?.id) return;
  await supabase.from('audit_log').insert({
    actor_id:    adminProfile.id,
    action:      action,
    entity_type: 'subscription',
    entity_id:   entityId,
    before_data: before,
    after_data:  after
  });
}

// ---------- HELPERS ----------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- WIRE UP ----------

els.search?.addEventListener('input', (e) => {
  state.search = e.target.value;
  applyFilters();
});
els.modalClose?.addEventListener('click', closeModal);

// ---------- INIT ----------

loadData();

// TODO: orders generated from a subscription should be linkable
// (e.g. an orders.subscription_id column + admin "generate this
// week's orders" action). For now the detail view just shows
// the customer's recent orders.
