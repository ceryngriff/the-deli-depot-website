// =========================================================
// ADMIN ORDERS — filterable orders table + detail view with
// status updates, admin notes, payment toggle, audit logging.
// =========================================================

import { adminProfile } from './admin-shared.js'; // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'collected', 'cancelled'];

let orders = [];
let filtered = [];
let viewing = null;

const state = {
  status:    'all',
  dateRange: 'all',
  search:    ''
};

// ---------- DOM REFS ----------

const els = {
  tabs:        document.getElementById('status-tabs'),
  dateFilter:  document.getElementById('date-filter'),
  search:      document.getElementById('search-input'),
  tbody:       document.getElementById('orders-tbody'),
  footerCount: document.getElementById('orders-count'),

  modal:       document.getElementById('order-modal'),
  modalTitle:  document.getElementById('order-modal-title'),
  modalClose:  document.getElementById('order-modal-close'),
  modalBody:   document.getElementById('order-modal-body')
};

// ---------- URL PRESETS (from dashboard cards) ----------

(function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const s = p.get('status');
  if (s && (STATUSES.includes(s) || s === 'all')) state.status = s;
  const d = p.get('date');
  if (d && ['today', 'tomorrow', 'week', 'all'].includes(d)) state.dateRange = d;
})();

// ---------- LOAD ----------

async function loadOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  if (error) {
    toast('Could not load orders.', 'error');
    return;
  }
  orders = data || [];
  renderTabs();
  applyFilters();
}

// ---------- DATE HELPERS ----------

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isToday(dt) {
  if (!dt) return false;
  const t = startOfDay(new Date());
  const n = new Date(t); n.setDate(n.getDate() + 1);
  const d = new Date(dt);
  return d >= t && d < n;
}
function isTomorrow(dt) {
  if (!dt) return false;
  const t = startOfDay(new Date()); t.setDate(t.getDate() + 1);
  const n = new Date(t); n.setDate(n.getDate() + 1);
  const d = new Date(dt);
  return d >= t && d < n;
}
function isThisWeek(dt) {
  if (!dt) return false;
  const t = startOfDay(new Date());
  const n = new Date(t); n.setDate(n.getDate() + 7);
  const d = new Date(dt);
  return d >= t && d < n;
}

// ---------- FILTERS ----------

function applyFilters() {
  filtered = orders.filter((o) => {
    if (state.status !== 'all' && o.status !== state.status) return false;

    if (state.dateRange !== 'all') {
      const slot = o.collection_slot ? new Date(o.collection_slot) : null;
      if (state.dateRange === 'today'    && !isToday(slot))    return false;
      if (state.dateRange === 'tomorrow' && !isTomorrow(slot)) return false;
      if (state.dateRange === 'week'     && !isThisWeek(slot)) return false;
    }

    if (state.search) {
      const hay = `${o.order_number} ${o.customer_name || ''} ${o.customer_email || ''} ${o.customer_phone || ''}`.toLowerCase();
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
    ['all',        'All'],
    ['pending',    'Pending'],
    ['confirmed',  'Confirmed'],
    ['preparing',  'Preparing'],
    ['ready',      'Ready'],
    ['collected',  'Collected'],
    ['cancelled',  'Cancelled']
  ];
  els.tabs.innerHTML = labels.map(([k, label]) => {
    const count = k === 'all'
      ? orders.length
      : orders.filter((o) => o.status === k).length;
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
      <tr><td colspan="8" class="admin-table__empty">No orders match these filters.</td></tr>
    `;
    if (els.footerCount) els.footerCount.textContent = '';
    return;
  }
  els.tbody.innerHTML = filtered.map(rowHtml).join('');
  if (els.footerCount) {
    els.footerCount.textContent =
      `Showing ${filtered.length} of ${orders.length} order${orders.length === 1 ? '' : 's'}`;
  }
  els.tbody.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.view));
  });
}

function rowHtml(o) {
  const items = (o.order_items || []).reduce((s, i) => s + i.quantity, 0);
  const slot = o.collection_slot
    ? new Date(o.collection_slot).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
    : 'TBC';
  return `
    <tr>
      <td><strong style="color: var(--gold);">${escapeHtml(o.order_number)}</strong></td>
      <td>
        <p class="admin-table__name">${escapeHtml(o.customer_name || 'Guest')}</p>
        <p class="admin-table__slug">${escapeHtml(o.customer_email || '')}</p>
      </td>
      <td>${items}</td>
      <td style="font-size: 0.85rem;">${escapeHtml(slot)}</td>
      <td>£${parseFloat(o.total || 0).toFixed(2)}</td>
      <td><span class="status-badge status-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
      <td><span class="status-badge status-${o.payment_status === 'paid' ? 'ready' : 'pending'}">${escapeHtml(o.payment_status)}</span></td>
      <td class="admin-table__actions">
        <button class="btn btn--outline" data-view="${escapeHtml(o.id)}">View</button>
      </td>
    </tr>
  `;
}

// ---------- DETAIL MODAL ----------

function openModal(orderId) {
  viewing = orders.find((o) => o.id === orderId);
  if (!viewing) return;
  els.modalTitle.textContent = viewing.order_number;
  renderDetail();
  els.modal.showModal();
}

function closeModal() {
  if (els.modal.open) els.modal.close();
  viewing = null;
}

function renderDetail() {
  if (!viewing || !els.modalBody) return;
  const o = viewing;
  const items = o.order_items || [];

  const created = new Date(o.created_at).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  const slot = o.collection_slot
    ? new Date(o.collection_slot).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
    : 'TBC';

  // Aggregate macros
  let mTotal = null;
  if (items.length) {
    const m = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    items.forEach((it) => {
      if (it.macros) {
        m.kcal    += (it.macros.kcal    || 0) * it.quantity;
        m.protein += (it.macros.protein || 0) * it.quantity;
        m.carbs   += (it.macros.carbs   || 0) * it.quantity;
        m.fat     += (it.macros.fat     || 0) * it.quantity;
      }
    });
    if (m.kcal > 0) mTotal = m;
  }

  els.modalBody.innerHTML = `
    <div class="order-detail">

      <div class="order-detail__head">
        <span class="order-detail__num">${escapeHtml(o.order_number)}</span>
        <span class="order-detail__date">Placed ${escapeHtml(created)}</span>
      </div>

      <section class="order-detail__section">
        <h3>Customer</h3>
        <dl class="order-detail__grid">
          <div><dt>Name</dt><dd>${escapeHtml(o.customer_name || 'Guest')}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(o.customer_email || '—')}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(o.customer_phone || '—')}</dd></div>
          <div><dt>Account</dt><dd>${o.customer_id ? 'Registered' : 'Guest'}</dd></div>
        </dl>
      </section>

      <section class="order-detail__section">
        <h3>Collection</h3>
        <dl class="order-detail__grid">
          <div><dt>Slot</dt><dd>${escapeHtml(slot)}</dd></div>
          <div><dt>Total</dt><dd>£${parseFloat(o.total || 0).toFixed(2)}</dd></div>
        </dl>
      </section>

      <section class="order-detail__section">
        <h3>Items (${items.length})</h3>
        <ul class="order-line-items">
          ${items.map(itemHtml).join('')}
        </ul>
        ${mTotal ? `
          <p style="margin: 1rem 0 0; font-size: 0.85rem; color: var(--cream-muted);">
            <strong style="color: var(--gold);">Total macros:</strong>
            ${Math.round(mTotal.kcal)} kcal · ${Math.round(mTotal.protein)}g protein ·
            ${Math.round(mTotal.carbs)}g carbs · ${Math.round(mTotal.fat)}g fat
          </p>
        ` : ''}
      </section>

      ${o.notes ? `
        <section class="order-detail__section">
          <h3>Customer Notes</h3>
          <p style="margin: 0; color: var(--cream);">${escapeHtml(o.notes)}</p>
        </section>
      ` : ''}

      <section class="order-detail__section">
        <h3>Status &amp; Actions</h3>
        <div class="admin-form__row">
          <label class="admin-field">
            <span>Order Status</span>
            <select id="status-select">
              ${STATUSES.map((s) => `
                <option value="${s}" ${s === o.status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>
              `).join('')}
            </select>
          </label>
          <label class="admin-field">
            <span>Payment</span>
            <select id="payment-select">
              <option value="unpaid"   ${o.payment_status === 'unpaid'   ? 'selected' : ''}>Unpaid</option>
              <option value="paid"     ${o.payment_status === 'paid'     ? 'selected' : ''}>Paid</option>
              <option value="refunded" ${o.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option>
            </select>
          </label>
        </div>

        <label class="admin-field" style="margin-top: 1rem;">
          <span>Admin Notes (internal)</span>
          <textarea id="admin-notes-input" rows="3"
            placeholder="Notes for the team — customer won't see these.">${escapeHtml(o.admin_notes || '')}</textarea>
        </label>

        <div class="order-detail__actions" style="margin-top: 1rem;">
          <button id="save-changes-btn" class="btn">Save Changes</button>
          <button id="send-sms-btn" class="btn btn--outline">Send Collection-Ready SMS</button>
        </div>
      </section>

    </div>
  `;

  document.getElementById('save-changes-btn')?.addEventListener('click', saveChanges);
  document.getElementById('send-sms-btn')?.addEventListener('click', sendSms);
}

function itemHtml(it) {
  const bundle = {
    single:         'Single',
    bundle_5:       '5 Pack',
    bundle_10:      '10 Pack',
    build_your_own: 'Build Your Own'
  }[it.bundle_type] || it.bundle_type;

  const macros = it.macros
    ? `${it.macros.kcal || 0} kcal · ${it.macros.protein || 0}g protein · ${it.macros.carbs || 0}g carbs · ${it.macros.fat || 0}g fat`
    : '';

  // Build Your Own breakdown WITH kitchen portions, so staff know exactly
  // what to plate. Names + amounts come from the shared js/builder-data.js.
  let buildHtml = '';
  if (it.build_details) {
    const bd = it.build_details;
    const look = (id) => (window.findBuilderItem ? window.findBuilderItem(id) : null);
    const nameOf = (id) => { const x = look(id); return x ? x.name : id; };
    const amtOf  = (id) => { const x = look(id); return x && x.amount ? x.amount : ''; };
    const lines = [];

    if (bd.protein) {
      const amt = bd.proteinPortion ? `${bd.proteinPortion}g` : '';
      lines.push(`<strong>Protein:</strong> ${escapeHtml(nameOf(bd.protein))}${amt ? ` — ${escapeHtml(amt)}` : ''}`);
    }
    if (bd.carb) {
      const a = amtOf(bd.carb);
      lines.push(`<strong>Carb:</strong> ${escapeHtml(nameOf(bd.carb))}${a ? ` — ${escapeHtml(a)}` : ''}`);
    }
    if (bd.veg?.length) {
      const vegStr = bd.veg.map((id) => {
        const a = amtOf(id);
        return `${escapeHtml(nameOf(id))}${a ? ` (${escapeHtml(a)})` : ''}`;
      }).join(', ');
      lines.push(`<strong>Veg:</strong> ${vegStr}`);
    }
    if (bd.sauce) {
      const a = amtOf(bd.sauce);
      lines.push(`<strong>Sauce:</strong> ${escapeHtml(nameOf(bd.sauce))}${a ? ` — ${escapeHtml(a)}` : ''}`);
    }
    buildHtml = lines.map((l) => `<span class="order-build-line">${l}</span>`).join('');
  }

  return `
    <li>
      <div class="order-line-items__head">
        <strong>${escapeHtml(it.meal_name)}</strong>
        <span>£${parseFloat(it.line_total).toFixed(2)}</span>
      </div>
      <p class="order-line-items__sub">${escapeHtml(bundle)} · ×${it.quantity} @ £${parseFloat(it.unit_price).toFixed(2)}</p>
      ${buildHtml ? `<div class="order-line-items__build">${buildHtml}</div>` : ''}
      ${macros ? `<p class="order-line-items__sub" style="margin-top:0.2rem;">${escapeHtml(macros)}</p>` : ''}
    </li>
  `;
}

// ---------- SAVE CHANGES ----------

async function saveChanges() {
  if (!viewing) return;
  const newStatus = document.getElementById('status-select').value;
  const newPayment = document.getElementById('payment-select').value;
  const newNotes = document.getElementById('admin-notes-input').value.trim();

  const updates = {};
  const before = {};
  const after  = {};

  if (newStatus !== viewing.status) {
    updates.status = newStatus;
    before.status = viewing.status;
    after.status  = newStatus;
  }
  if (newPayment !== viewing.payment_status) {
    updates.payment_status = newPayment;
    before.payment_status = viewing.payment_status;
    after.payment_status  = newPayment;
  }
  if (newNotes !== (viewing.admin_notes || '').trim()) {
    updates.admin_notes = newNotes || null;
    before.admin_notes = viewing.admin_notes;
    after.admin_notes  = newNotes || null;
  }

  if (Object.keys(updates).length === 0) {
    toast('Nothing changed.', 'info');
    return;
  }

  const btn = document.getElementById('save-changes-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await supabase.from('orders').update(updates).eq('id', viewing.id);

  if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

  if (error) {
    toast(error.message || 'Could not save.', 'error');
    return;
  }

  // Audit
  let action = 'updated_order';
  if (Object.keys(updates).length === 1 && 'status' in updates)         action = 'changed_order_status';
  else if (Object.keys(updates).length === 1 && 'payment_status' in updates) action = 'changed_payment_status';
  else if (Object.keys(updates).length === 1 && 'admin_notes' in updates)    action = 'updated_admin_notes';

  await writeAudit(action, viewing.id, before, after);

  // Update local cache + UI
  Object.assign(viewing, updates);
  applyFilters();
  renderTabs();
  toast('Order saved.', 'success');
  closeModal();
}

// ---------- SEND COLLECTION-READY SMS ----------
// Texts the customer their order is ready, via the send-sms Netlify Function.
// The function re-reads the phone from the order server-side and requires a
// valid admin session (we pass the admin's access token), so the browser is
// never trusted with who can send a (paid-for) text.

async function sendSms() {
  if (!viewing) return;
  if (!viewing.customer_phone) {
    toast('No phone number on this order.', 'error');
    return;
  }
  if (viewing.status !== 'ready') {
    if (!confirm(`Order isn't marked "Ready" yet — send the SMS anyway?`)) return;
  }

  const btn = document.getElementById('send-sms-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast('Your admin session expired — please sign in again.', 'error');
      return;
    }

    const resp = await fetch('/.netlify/functions/send-sms', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body:    JSON.stringify({ orderId: viewing.id })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) throw new Error(data.error || `Failed (${resp.status})`);

    toast(`Text sent to ${data.to}.`, 'success');
  } catch (e) {
    console.error('[admin-orders] send-sms', e);
    toast(`Couldn't send the text: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Collection-Ready SMS'; }
  }
}

// ---------- AUDIT LOG ----------

async function writeAudit(action, entityId, before, after) {
  if (!adminProfile?.id) return;
  await supabase.from('audit_log').insert({
    actor_id:    adminProfile.id,
    action:      action,
    entity_type: 'order',
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
els.dateFilter?.addEventListener('change', (e) => {
  state.dateRange = e.target.value;
  applyFilters();
});
els.modalClose?.addEventListener('click', closeModal);

// Pre-set the date filter <select> from URL on first paint
if (els.dateFilter) els.dateFilter.value = state.dateRange;

// ---------- INIT ----------

loadOrders();
window.addEventListener('focus', loadOrders);
