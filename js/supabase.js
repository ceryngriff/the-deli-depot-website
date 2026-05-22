// =========================================================
// SUPABASE CLIENT
// Single source of truth for the Supabase JS v2 client.
// All modules that talk to Supabase should import { supabase } from here.
// =========================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

// Convenience: expose on window for ad-hoc console debugging
window.__supabase = supabase;
