// =========================================================
// ORDER CONFIRMATION PAGE
// Reads ?order=DD-2026-XXXX. For guest orders RLS blocks
// fetching back, so we first look at sessionStorage which
// the checkout step populated. Signed-in customers also
// have a direct DB fallback.
// =========================================================

import { supabase } from './supabase.js';
import { getSession } from './auth.js';

function getOrderNumber() {
  return new URLSearchParams(window.location.search).get('order');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function bundleLabel(b) {
  switch (b) {
    case 'single':         return 'Single Meal';
    case 'bundle_5':       return '5 Pack';
    case 'bundle_10':      return '10 Pack';
    case 'build_your_own': return 'Build Your Own';
    default:               return b || 'Single';
  }
}

function render({ order, items }) {
  document.getElementById('order-number').textContent = order.order_number;
  document.getElementById('order-status').textContent = (order.status || 'pending')
    .charAt(0).toUpperCase() + (order.status || 'pending').slice(1);
  document.getElementById('order-collection').textContent = formatDateTime(order.collection_slot);
  document.getElementById('order-customer').textContent = order.customer_name || '—';
  document.getElementById('order-total').textContent = `£${parseFloat(order.total).toFixed(2)}`;

  // Payment status (capitalised) when the cached/DB order carries it.
  const paymentEl = document.getElementById('order-payment');
  if (paymentEl) {
    const ps = order.payment_status;
    paymentEl.textContent = ps
      ? ps.charAt(0).toUpperCase() + ps.slice(1)
      : 'On collection';
  }

  const list = document.getElementById('order-items');
  list.innerHTML = items.map((i) => `
    <li>
      <span><strong>${escapeHtml(i.meal_name)}</strong> <small style="color: var(--muted);">${escapeHtml(bundleLabel(i.bundle_type))} · ×${i.quantity}</small></span>
      <span>£${parseFloat(i.line_total).toFixed(2)}</span>
    </li>
  `).join('');

  document.getElementById('confirmation-loading').hidden = true;
  document.getElementById('confirmation-content').hidden = false;
}

function showNotFound(message) {
  document.getElementById('confirmation-loading').hidden = true;
  const main = document.querySelector('main .container');
  if (main) {
    main.innerHTML = `
      <div class="confirmation-card">
        <h1 class="confirmation-card__title">Order Not Found</h1>
        <p style="color: var(--cream-muted);">${escapeHtml(message)}</p>
        <div class="confirmation-actions">
          <a class="btn" href="menu.html">Back to Menu</a>
          <a class="btn btn--outline" href="account.html">My Account</a>
        </div>
      </div>
    `;
  }
}

async function loadOrder() {
  const orderNumber = getOrderNumber();
  if (!orderNumber) {
    showNotFound('No order number was provided.');
    return;
  }

  // 1. Try sessionStorage (works for both guests and signed-in users
  // who just placed an order)
  try {
    const cached = sessionStorage.getItem('dd_last_order');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.order?.order_number === orderNumber) {
        render(parsed);
        return;
      }
    }
  } catch (e) { /* sessionStorage unavailable */ }

  // 2. Fall back to Supabase (only works for signed-in customers
  // because of RLS — guests get nothing here)
  const session = await getSession();
  if (!session) {
    showNotFound(`We can't show this order's details here. Sign in to view your order history, or check the email confirmation we'll send.`);
    return;
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (orderErr || !order) {
    showNotFound('That order number doesn\'t belong to your account.');
    return;
  }

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  if (itemsErr) {
    showNotFound('Found the order, but couldn\'t load its items.');
    return;
  }

  render({ order, items: items || [] });
}

loadOrder();
