// =========================================================
// NAV — updates the sign-in / account button based on session
// (basket counter is handled by js/basket.js which already
// runs on every page that includes it).
// =========================================================

import { getSession, signOut, onAuthChange } from './auth.js';

async function updateAccountButton() {
  const session = await getSession();
  const signedIn = !!session;

  document.querySelectorAll('[data-account-button]').forEach((btn) => {
    if (signedIn) {
      btn.textContent = 'My Account';
      btn.setAttribute('href', 'account.html');
      btn.setAttribute('aria-label', 'My account');
    } else {
      btn.textContent = 'Sign In';
      btn.setAttribute('href', 'login.html');
      btn.setAttribute('aria-label', 'Sign in');
    }
  });

  // Show/hide elements based on auth state (use data-auth="signed-in" or "signed-out").
  document.querySelectorAll('[data-auth="signed-in"]').forEach((el) => {
    el.hidden = !signedIn;
  });
  document.querySelectorAll('[data-auth="signed-out"]').forEach((el) => {
    el.hidden = signedIn;
  });
}

// Global click handler so any element with data-sign-out signs out.
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-sign-out]');
  if (!target) return;
  e.preventDefault();
  await signOut();
  // After sign-out, send the user home unless data-sign-out has a value.
  const dest = target.getAttribute('data-sign-out') || 'index.html';
  window.location.href = dest;
});

// Initial paint + react to sign-in/out (this tab or another).
updateAccountButton();
onAuthChange(() => updateAccountButton());
