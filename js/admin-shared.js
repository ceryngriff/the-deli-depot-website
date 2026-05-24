// =========================================================
// ADMIN SHARED — common scaffolding for every admin page.
// - Runs requireAdmin() guard
// - Renders "Access denied" UI for signed-in non-admins
// - Auto-redirects on SIGNED_OUT
// - Updates the pending-orders badge on the Orders nav item
// - Wires sign-out buttons
//
// Pages import this BEFORE any other DB calls.
// =========================================================

import { supabase } from './supabase.js';
import { requireAdmin, signOut, onAuthChange } from './auth.js';

const result = await requireAdmin();
if (!result) {
  // requireAdmin already redirected — stop the page bootstrapping.
  throw new Error('not authenticated');
}

if (result.denied) {
  renderDenied();
  throw new Error('access denied');
}

// We're an admin. Wire up shared chrome.
export const adminProfile = result.profile;
export const adminSession = result.session;

// Sign-out buttons (any element with [data-sign-out])
document.querySelectorAll('[data-sign-out]').forEach((el) => {
  el.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
    window.location.href = '/admin/login.html';
  });
});

// Redirect on sign-out from another tab.
onAuthChange((event) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = '/admin/login.html';
  }
});

// Pending-orders badge on the Orders nav item.
async function updatePendingCount() {
  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return;
  document.querySelectorAll('[data-pending-count]').forEach((el) => {
    el.textContent = String(count || 0);
    el.hidden = !count;
  });
}
updatePendingCount();
window.addEventListener('focus', updatePendingCount);

// Greeting in the topbar.
const greetingEl = document.querySelector('[data-admin-greeting]');
if (greetingEl) {
  greetingEl.textContent =
    (adminProfile?.full_name?.trim() || adminSession.user.email?.split('@')[0] || 'Admin');
}

// Mobile sidebar toggle.
const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
const sidebar = document.querySelector('.admin-sidebar');
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('is-open');
  });
}

// ---------- DENIED VIEW ----------

function renderDenied() {
  document.body.innerHTML = `
    <main style="min-height: 100vh; display: grid; place-items: center; padding: 2rem; background: var(--bg); color: var(--cream); text-align: center; font-family: var(--sans);">
      <div style="max-width: 480px;">
        <p style="font-family: var(--serif); color: var(--gold); font-size: 1.6rem; margin: 0 0 0.5rem;">Hold on…</p>
        <h1 style="font-size: 1.8rem; font-weight: 300; margin: 0 0 1rem;">Access Denied</h1>
        <p style="color: var(--cream-muted); margin: 0 0 1.5rem;">
          This area is for staff only. Ask the owner to give your account admin access if you think this is a mistake.
        </p>
        <div style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
          <a class="btn" href="/index.html">Back to Home</a>
          <a class="btn btn--outline" href="/account.html">My Account</a>
          <button class="btn btn--outline" data-sign-out>Sign Out</button>
        </div>
      </div>
    </main>
  `;
  document.querySelectorAll('[data-sign-out]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      window.location.href = '/admin/login.html';
    });
  });
}
