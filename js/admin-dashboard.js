// =========================================================
// ADMIN DASHBOARD — overview metrics + today's collections.
// =========================================================

import './admin-shared.js'; // route guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

const els = {
  pending:   document.getElementById('metric-pending'),
  today:     document.getElementById('metric-today'),
  revenue:   document.getElementById('metric-revenue'),
  subs:      document.getElementById('metric-subs'),
  newCust:   document.getElementById('metric-new-customers'),
  collections: document.getElementById('todays-collections')
};

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

async function loadMetrics() {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [pendingRes, todayRes, revenueRes, subsRes, newCustRes, collectionsRes] =
    await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true })
        .gte('collection_slot', today.toISOString())
        .lt('collection_slot', tomorrow.toISOString()),
      supabase.from('orders').select('total')
        .gte('created_at', sevenDaysAgo.toISOString())
        .neq('status', 'cancelled'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('role', 'customer'),
      supabase.from('orders')
        .select('id, order_number, customer_name, customer_phone, collection_slot, status, total, order_items(meal_name, quantity, bundle_type)')
        .gte('collection_slot', today.toISOString())
        .lt('collection_slot', tomorrow.toISOString())
        .order('collection_slot', { ascending: true })
    ]);

  if (els.pending)  els.pending.textContent  = pendingRes.count ?? 0;
  if (els.today)    els.today.textContent    = todayRes.count ?? 0;
  if (els.subs)     els.subs.textContent     = subsRes.count ?? 0;
  if (els.newCust)  els.newCust.textContent  = newCustRes.count ?? 0;
  if (els.revenue) {
    const sum = (revenueRes.data || [])
      .reduce((s, o) => s + parseFloat(o.total || 0), 0);
    els.revenue.textContent = `£${sum.toFixed(2)}`;
  }

  renderCollections(collectionsRes.data || []);
}

function renderCollections(orders) {
  if (!els.collections) return;
  if (orders.length === 0) {
    els.collections.innerHTML = `
      <p class="dash-empty">No collections scheduled for today.</p>
    `;
    return;
  }

  // Group by time-of-day slot
  const groups = { 'Morning': [], 'Afternoon': [], 'Evening': [] };
  orders.forEach((o) => {
    const h = new Date(o.collection_slot).getHours();
    const key = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    groups[key].push(o);
  });

  els.collections.innerHTML = Object.entries(groups)
    .filter(([, items]) => items.length)
    .map(([slot, items]) => `
      <div class="collections-group">
        <h3 class="collections-group__title">${escapeHtml(slot)}
          <span class="collections-group__count">${items.length}</span>
        </h3>
        <div class="collections-group__list">
          ${items.map(collectionCardHtml).join('')}
        </div>
      </div>
    `).join('');

  els.collections.querySelectorAll('[data-status-change]').forEach((btn) => {
    btn.addEventListener('click', () =>
      changeStatus(btn.dataset.orderId, btn.dataset.statusChange));
  });
}

function collectionCardHtml(o) {
  const time = new Date(o.collection_slot).toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  const totalItems = (o.order_items || []).reduce((s, i) => s + i.quantity, 0);

  const canPrep      = ['pending', 'confirmed'].includes(o.status);
  const canReady     = ['pending', 'confirmed', 'preparing'].includes(o.status);
  const canCollected = o.status === 'ready';

  return `
    <div class="collection-card" data-id="${escapeHtml(o.id)}">
      <div class="collection-card__head">
        <span class="collection-card__time">${escapeHtml(time)}</span>
        <span class="status-badge status-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>
      </div>
      <p class="collection-card__name"><strong>${escapeHtml(o.customer_name || 'Guest')}</strong></p>
      <p class="collection-card__meta">${escapeHtml(o.order_number)} · ${totalItems} item${totalItems === 1 ? '' : 's'} · £${parseFloat(o.total).toFixed(2)}</p>
      <div class="collection-card__actions">
        ${canPrep ? `<button class="btn btn--sm" data-order-id="${escapeHtml(o.id)}" data-status-change="preparing">Mark Preparing</button>` : ''}
        ${canReady ? `<button class="btn btn--sm" data-order-id="${escapeHtml(o.id)}" data-status-change="ready">Mark Ready</button>` : ''}
        ${canCollected ? `<button class="btn btn--sm" data-order-id="${escapeHtml(o.id)}" data-status-change="collected">Mark Collected</button>` : ''}
      </div>
    </div>
  `;
}

async function changeStatus(id, newStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', id);
  if (error) {
    toast(error.message || 'Could not update order.', 'error');
    return;
  }
  toast(`Marked ${newStatus}.`, 'success');
  loadMetrics();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

loadMetrics();
// Refresh metrics when tab regains focus
window.addEventListener('focus', loadMetrics);
