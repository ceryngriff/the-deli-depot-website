// =========================================================
// LOGIN.HTML CONTROLLER
// Tab switching, three auth methods, redirect handling.
// =========================================================

import {
  signUpWithPassword,
  signInWithPassword,
  signInWithMagicLink,
  signInWithGoogle,
  getSession
} from './auth.js';

// ---------- HELPERS ----------

function defaultRedirectTarget() {
  // When sign-in happens at /admin/login.html, default landing
  // is the admin dashboard; otherwise the customer account page.
  return window.location.pathname.includes('/admin/')
    ? '/admin/index.html'
    : 'account.html';
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('redirect');
  if (!raw) return defaultRedirectTarget();
  // Open-redirect protection: resolve against our own origin and only accept
  // it if it stays on this site. This blocks absolute URLs (https://evil.com),
  // protocol-relative (//evil.com) and backslash tricks (/\evil.com).
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return defaultRedirectTarget();
    return u.pathname + u.search + u.hash;
  } catch {
    return defaultRedirectTarget();
  }
}

function showMessage(text, type = 'info') {
  const box = document.getElementById('auth-message');
  if (!box) return;
  box.textContent = text;
  box.className = `auth-message auth-message--${type}`;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideMessage() {
  const box = document.getElementById('auth-message');
  if (box) box.hidden = true;
}

function setLoading(btn, loadingText) {
  if (!btn) return () => {};
  const original = btn.textContent;
  btn.disabled = true;
  btn.dataset.originalText = original;
  btn.textContent = loadingText;
  return () => {
    btn.disabled = false;
    btn.textContent = original;
  };
}

// ---------- REDIRECT IF ALREADY SIGNED IN ----------

(async function redirectIfAuthed() {
  const session = await getSession();
  if (session) {
    window.location.replace(getRedirectTarget());
  }
})();

// ---------- TAB SWITCHING ----------

const tabs = document.querySelectorAll('.auth-tab');
const panels = document.querySelectorAll('.auth-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== target;
    });
    hideMessage();
  });
});

// ---------- SIGN IN (email + password) ----------

document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    showMessage('Enter your email and password.', 'error');
    return;
  }
  const done = setLoading(form.querySelector('button[type="submit"]'), 'Signing in…');
  let error;
  try {
    // Guard against a hung request leaving the button stuck on "Signing in…":
    // if it doesn't resolve in 15s, surface a clear, retryable error.
    const result = await Promise.race([
      signInWithPassword({ email, password }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000))
    ]);
    error = result.error;
  } catch (err) {
    done();
    showMessage(
      err?.message === 'timeout'
        ? 'Sign-in is taking too long — check your connection and try again.'
        : (err?.message || 'Sign-in failed. Please try again.'),
      'error'
    );
    return;
  }
  done();
  if (error) {
    showMessage(error.message || 'Sign-in failed.', 'error');
    return;
  }
  window.location.href = getRedirectTarget();
});

// ---------- SIGN UP (email + password) ----------

document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();
  const form = e.currentTarget;
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    showMessage('Please fill in every field.', 'error');
    return;
  }
  if (password.length < 6) {
    showMessage('Password must be at least 6 characters.', 'error');
    return;
  }
  const done = setLoading(form.querySelector('button[type="submit"]'), 'Creating account…');
  const { data, error } = await signUpWithPassword({ email, password, fullName });
  done();
  if (error) {
    showMessage(error.message || 'Sign-up failed.', 'error');
    return;
  }
  if (data?.session) {
    window.location.href = getRedirectTarget();
  } else {
    showMessage(
      `Account created. Check ${email} for a confirmation link, then sign in.`,
      'success'
    );
  }
});

// ---------- MAGIC LINK ----------

document.querySelectorAll('[data-magic-link]').forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    hideMessage();
    const panel = btn.closest('.auth-panel');
    const emailInput = panel?.querySelector('input[name="email"]');
    const email = emailInput?.value.trim();
    if (!email) {
      showMessage('Enter your email above, then click magic link.', 'error');
      emailInput?.focus();
      return;
    }
    const done = setLoading(btn, 'Sending…');
    const { error } = await signInWithMagicLink({ email });
    done();
    if (error) {
      showMessage(error.message || 'Could not send magic link.', 'error');
      return;
    }
    showMessage(
      `We've sent a magic link to ${email}. Click it from your email to sign in.`,
      'success'
    );
  });
});

// ---------- GOOGLE OAUTH ----------

document.querySelectorAll('[data-google-signin]').forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    hideMessage();
    const done = setLoading(btn, 'Redirecting…');
    const target = getRedirectTarget();
    const redirectTo = new URL(target, window.location.origin).toString();
    const { error } = await signInWithGoogle({ redirectTo });
    if (error) {
      done();
      const msg = /provider is not enabled/i.test(error.message || '')
        ? 'Google sign-in is not enabled yet. Use email + password or magic link.'
        : error.message || 'Google sign-in failed.';
      showMessage(msg, 'error');
    }
    // Otherwise the browser navigates to Google and back; no further work here.
  });
});
