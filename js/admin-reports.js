// =========================================================
// ADMIN REPORTS — date-range metrics, revenue chart,
// top meals, status pie, customer breakdown, CSV export.
// Chart.js loaded dynamically from CDN (only this page).
// =========================================================

import './admin-shared.js';   // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

const Chart = (await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm')).default;

// ---------- STATE ----------

const state = {
  from: null,
  to:   null
};

const charts = {
  revenue: null,
  status:  null
};

// Default: this week (Mon -> Sun)
function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun, 1=Mon...
  const offset = day === 0 ? 6 : day - 1; // back to Monday
  x.setDate(x.getDate() - offset);
  return x;
}

(function defaultRange() {
  const today = new Date();
  state.from = startOfWeek(today);
  state.to = new Date(today); state.to.setHours(23, 59, 59, 999);
})();

// ---------- DOM REFS ----------

const els = {
  fromInput: document.getElementById('from-input'),
  toInput:   document.getElementById('to-input'),
  applyBtn:  document.getElementById('apply-range-btn'),
  presets:   document.querySelectorAll('[data-preset]'),
  exportBtn: document.getElementById('export-csv-btn'),

  mRevenue:  document.getElementById('m-revenue'),
  mOrders:   document.getElementById('m-orders'),
  mAvg:      document.getElementById('m-avg'),
  mSubs:     document.getElementById('m-subs'),

  revenueCanvas: document.getElementById('revenue-chart'),
  statusCanvas:  document.getElementById('status-chart'),
  topMeals:      document.getElementById('top-meals'),
  customers:     document.getElementById('customer-breakdown')
};

// Initialise date inputs
function syncInputs() {
  if (els.fromInput) els.fromInput.value = toDateISO(state.from);
  if (els.toInput)   els.toInput.value   = toDateISO(state.to);
}

// ---------- LOAD + RENDER ----------

async function loadAndRender() {
  // 1) Orders in range (incl. order_items)
  const { data: ordersInRange, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .gte('created_at', state.from.toISOString())
    .lte('created_at', state.to.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    toast('Could not load orders for this range.', 'error');
    return;
  }

  // 2) Active subscriptions count (not date-bound)
  const { count: activeSubs } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Filter cancelled out of revenue / line-item totals
  const billable = (ordersInRange || []).filter((o) => o.status !== 'cancelled');

  // ---- Top metrics ----
  const revenue = billable.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const orderCount = billable.length;
  const avg = orderCount ? revenue / orderCount : 0;

  if (els.mRevenue) els.mRevenue.textContent = `£${revenue.toFixed(2)}`;
  if (els.mOrders)  els.mOrders.textContent  = orderCount;
  if (els.mAvg)     els.mAvg.textContent     = `£${avg.toFixed(2)}`;
  if (els.mSubs)    els.mSubs.textContent    = activeSubs ?? 0;

  // ---- Revenue chart (daily) ----
  renderRevenueChart(billable);

  // ---- Status pie ----
  renderStatusChart(ordersInRange || []);

  // ---- Top meals ----
  renderTopMeals(billable);

  // ---- Customer breakdown ----
  await renderCustomerBreakdown(ordersInRange || []);
}

// ---------- REVENUE CHART ----------

function renderRevenueChart(orders) {
  const days = enumerateDays(state.from, state.to);
  const byDay = new Map(days.map((d) => [toDateISO(d), 0]));
  orders.forEach((o) => {
    const key = toDateISO(new Date(o.created_at));
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + parseFloat(o.total || 0));
  });

  const labels = days.map((d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const values = days.map((d) => byDay.get(toDateISO(d)) || 0);

  if (charts.revenue) charts.revenue.destroy();
  charts.revenue = new Chart(els.revenueCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Daily Revenue',
        data: values,
        backgroundColor: 'rgba(201, 169, 97, 0.5)',
        borderColor: '#c9a961',
        borderWidth: 1
      }]
    },
    options: chartOptions({ yPrefix: '£' })
  });
}

// ---------- STATUS PIE ----------

function renderStatusChart(orders) {
  const counts = { pending: 0, confirmed: 0, preparing: 0, ready: 0, collected: 0, cancelled: 0 };
  orders.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status]++; });

  if (charts.status) charts.status.destroy();
  charts.status = new Chart(els.statusCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Collected', 'Cancelled'],
      datasets: [{
        data: Object.values(counts),
        backgroundColor: [
          '#c9a961', // pending
          '#9cb8df', // confirmed
          '#d9a06c', // preparing
          '#b6d399', // ready
          '#8a8275', // collected
          '#c63d2f'  // cancelled
        ],
        borderColor: '#1a1a1a',
        borderWidth: 2
      }]
    },
    options: chartOptions({ pie: true })
  });
}

// ---------- TOP MEALS ----------

function renderTopMeals(billable) {
  const totals = new Map(); // meal_name -> { units, revenue }
  billable.forEach((o) => {
    (o.order_items || []).forEach((it) => {
      const key = it.meal_name || '(unknown)';
      const acc = totals.get(key) || { units: 0, revenue: 0 };
      acc.units   += it.quantity || 0;
      acc.revenue += parseFloat(it.line_total || 0);
      totals.set(key, acc);
    });
  });
  const top = Array.from(totals.entries())
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 10);

  if (top.length === 0) {
    els.topMeals.innerHTML = `<p class="admin-table__empty">No sales in this period.</p>`;
    return;
  }
  els.topMeals.innerHTML = `
    <div class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Meal</th>
            <th>Units Sold</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${top.map(([name, t], i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong style="color: var(--cream);">${escapeHtml(name)}</strong></td>
              <td>${t.units}</td>
              <td>£${t.revenue.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---------- CUSTOMER BREAKDOWN ----------

async function renderCustomerBreakdown(ordersInRange) {
  const customerIds = new Set(ordersInRange.map((o) => o.customer_id).filter(Boolean));
  let returningSet = new Set();
  if (customerIds.size > 0) {
    // Customers who placed an order BEFORE the start of this range.
    const { data: prior } = await supabase
      .from('orders')
      .select('customer_id')
      .lt('created_at', state.from.toISOString())
      .not('customer_id', 'is', null);
    returningSet = new Set((prior || []).map((o) => o.customer_id));
  }

  let newCount = 0, returningCount = 0, guestCount = 0;
  const seen = new Set();
  ordersInRange.forEach((o) => {
    if (!o.customer_id) { guestCount++; return; }
    if (seen.has(o.customer_id)) return;
    seen.add(o.customer_id);
    if (returningSet.has(o.customer_id)) returningCount++;
    else newCount++;
  });

  els.customers.innerHTML = `
    <div class="report-customer-tile">
      <p class="report-customer-tile__label">New Customers</p>
      <p class="report-customer-tile__value">${newCount}</p>
    </div>
    <div class="report-customer-tile">
      <p class="report-customer-tile__label">Returning</p>
      <p class="report-customer-tile__value">${returningCount}</p>
    </div>
    <div class="report-customer-tile">
      <p class="report-customer-tile__label">Guest Orders</p>
      <p class="report-customer-tile__value">${guestCount}</p>
    </div>
  `;
}

// ---------- CSV EXPORT ----------

async function exportCsv() {
  toast('Preparing CSV…', 'info');

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .gte('created_at', state.from.toISOString())
    .lte('created_at', state.to.toISOString())
    .order('created_at', { ascending: true });
  if (error) {
    toast('Could not export.', 'error');
    return;
  }

  const headers = [
    'order_number', 'order_date', 'customer_name', 'customer_email', 'customer_phone',
    'collection_slot', 'status', 'payment_status', 'subtotal', 'total', 'notes',
    'item_name', 'bundle_type', 'quantity', 'unit_price', 'line_total'
  ];

  const rows = [headers];
  (data || []).forEach((o) => {
    const base = [
      o.order_number,
      o.created_at,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.collection_slot,
      o.status,
      o.payment_status,
      o.subtotal,
      o.total,
      o.notes
    ];
    const items = o.order_items || [];
    if (items.length === 0) {
      rows.push([...base, '', '', '', '', '']);
    } else {
      items.forEach((it) => {
        rows.push([
          ...base,
          it.meal_name,
          it.bundle_type,
          it.quantity,
          it.unit_price,
          it.line_total
        ]);
      });
    }
  });

  const csv = rows.map(rowToCsv).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const fileName = `deli-depot-orders-${toDateISO(state.from)}-to-${toDateISO(state.to)}.csv`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('CSV downloaded.', 'success');
}

function rowToCsv(row) {
  return row.map(csvCell).join(',');
}
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- DATE / CHART HELPERS ----------

function enumerateDays(from, to) {
  const days = [];
  const cursor = new Date(from); cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);      end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  // Safety cap (a 90-day report is the most we want in a stack here)
  return days.slice(0, 90);
}

function toDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function chartOptions({ yPrefix = '', pie = false } = {}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#d8d2c4', font: { family: 'Montserrat, sans-serif', size: 11 } },
        display: pie
      }
    }
  };
  if (!pie) {
    base.scales = {
      x: {
        ticks: { color: '#a8a39a', font: { family: 'Montserrat, sans-serif', size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        ticks: {
          color: '#a8a39a',
          font: { family: 'Montserrat, sans-serif', size: 10 },
          callback: (v) => `${yPrefix}${v}`
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
        beginAtZero: true
      }
    };
  }
  return base;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- PRESETS / WIRE UP ----------

els.presets.forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today); endOfToday.setHours(23, 59, 59, 999);
    if (preset === 'today') {
      state.from = today;
      state.to = endOfToday;
    } else if (preset === 'week') {
      state.from = startOfWeek(today);
      state.to = endOfToday;
    } else if (preset === 'month') {
      state.from = new Date(today.getFullYear(), today.getMonth(), 1);
      state.to = endOfToday;
    } else if (preset === 'last30') {
      const start = new Date(today); start.setDate(start.getDate() - 29);
      state.from = start;
      state.to = endOfToday;
    }
    syncInputs();
    loadAndRender();
  });
});

els.applyBtn?.addEventListener('click', () => {
  if (els.fromInput.value) state.from = new Date(`${els.fromInput.value}T00:00:00`);
  if (els.toInput.value)   state.to   = new Date(`${els.toInput.value}T23:59:59`);
  if (state.from > state.to) {
    toast('Start date must be before end date.', 'error');
    return;
  }
  loadAndRender();
});

els.exportBtn?.addEventListener('click', exportCsv);

// ---------- INIT ----------

syncInputs();
loadAndRender();
