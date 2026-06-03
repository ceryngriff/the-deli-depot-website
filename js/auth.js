// =========================================================
// AUTH HELPERS
// Wraps Supabase auth + profile syncing + route guards.
// =========================================================

import { supabase } from './supabase.js';

// ---------- SIGN UP / SIGN IN ----------

export async function signUpWithPassword({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || '' },
      emailRedirectTo: `${window.location.origin}/account.html`
    }
  });
  return { data, error };
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data?.user) {
    // Fire-and-forget: keeping the profile row in sync must NOT block (or
    // hang) the sign-in itself. A slow/blocked profile update here used to
    // leave the button stuck on "Signing in…".
    syncProfile(data.user).catch((e) => console.warn('[auth] profile sync', e));
  }
  return { data, error };
}

export async function signInWithMagicLink({ email }) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/account.html`
    }
  });
  return { data, error };
}

export async function signInWithGoogle({ redirectTo } = {}) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/account.html`
    }
  });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

// ---------- SESSION ----------

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('[auth] profile fetch error', error);
    return null;
  }
  return data;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

// ---------- PROFILE SYNC ----------
//
// The handle_new_user() trigger inserts a profile row on signup (using
// raw_user_meta_data.full_name), so we only need to UPDATE here to keep the
// row in sync — e.g. for OAuth users whose name lives at `name` instead of
// `full_name`, or password users whose email/name has changed.
//
// We don't INSERT from the client because there is no INSERT policy for
// the user on `profiles` — RLS leaves that to the trigger.

async function syncProfile(user) {
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    '';
  const updates = { email: user.email };
  if (fullName) updates.full_name = fullName;
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);
  if (error) console.warn('[auth] profile update', error);
}

// Public so OAuth callback pages can re-sync after first sign-in.
export { syncProfile };

// ---------- ROUTE GUARDS ----------

// Use on any page that must be signed in. If not signed in, redirects to
// login.html with ?redirect=<current-page> so the user returns here after.
export async function requireAuth({ redirectTo = 'login.html' } = {}) {
  const session = await getSession();
  if (!session) {
    const current = encodeURIComponent(
      window.location.pathname.split('/').pop() + window.location.search
    );
    window.location.replace(`${redirectTo}?redirect=${current}`);
    return null;
  }
  return session;
}

// Use on admin pages. Returns { session, profile, denied }.
//  - Not signed in -> redirects to /admin/login.html (absolute so it
//    works regardless of how deeply nested the calling page is).
//  - Signed in but not admin -> resolves with denied=true so the page
//    can render an "Access denied" view instead of a hard redirect.
export async function requireAdmin({ loginUrl = '/admin/login.html' } = {}) {
  const session = await getSession();
  if (!session) {
    // Use an absolute path for the redirect target so the login page
    // can navigate back regardless of its own URL.
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${loginUrl}?redirect=${current}`);
    return null;
  }
  const profile = await getCurrentProfile();
  const denied = !profile || profile.role !== 'admin';
  return { session, profile, denied };
}
