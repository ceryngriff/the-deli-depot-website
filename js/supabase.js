// =========================================================
// SUPABASE CLIENT
// Single source of truth for the Supabase JS v2 client.
// All modules that talk to Supabase should import { supabase } from here.
//
// The library is SELF-HOSTED (js/vendor/supabase.umd.js) rather than pulled
// from a third-party CDN. The CDN's ESM entry fans out to ~5 extra downloads,
// which made every page slow (and occasionally fail) on weak mobile
// connections. The vendored UMD build is one file served from our own domain.
// To update it: re-download dist/umd/supabase.js for the desired version from
// https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<version>/dist/umd/supabase.js
// =========================================================

// Load the vendored library once (it defines a global `supabase` namespace).
// Top-level await means every module that imports this file waits until the
// client below is ready, so callers still get a fully-initialised client.
if (!window.supabase?.createClient) {
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('vendor/supabase.umd.js', import.meta.url).href;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load js/vendor/supabase.umd.js'));
    document.head.appendChild(s);
  });
}

const { createClient } = window.supabase;

const config = window.SUPABASE_CONFIG;

if (!config || !config.url || !config.anonKey || config.url.includes('YOUR-PROJECT')) {
  console.error(
    '[Deli Depot] Supabase config missing or unconfigured.\n' +
    '  - Locally: edit js/env.js with your Project URL and publishable/anon key.\n' +
    '  - On Netlify: add the snippet injection from supabase/README.md.'
  );
}

export const supabase = createClient(
  config?.url || 'https://invalid.supabase.co',
  config?.anonKey || 'invalid-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Convenience: expose the client on window for ad-hoc console debugging.
// (window.supabase is the library namespace; the client is window.__supabase.)
window.__supabase = supabase;
