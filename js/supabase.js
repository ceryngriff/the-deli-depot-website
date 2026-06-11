// SUPABASE CLIENT
// Uses the official ESM build from esm.sh CDN (works in native ES modules).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.SUPABASE_CONFIG;

if (!config || !config.url || !config.anonKey || config.url.includes('YOUR-PROJECT')) {
    console.error('[Deli Depot] Supabase config missing – check js/env.js or Netlify env vars.');
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

window.__supabase = supabase;
