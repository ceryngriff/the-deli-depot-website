// =========================================================
// SUPABASE CONFIG — template
// =========================================================
// 1. Copy this file to js/env.js (in the same folder).
// 2. Replace the two values below with your Supabase Project URL
//    and anon/public key. Find them at:
//      Supabase dashboard → Project Settings → API
// 3. js/env.js is gitignored, so your local keys never get committed.
//
// For Netlify deploys, do NOT commit env.js — instead set up the
// snippet injection described in supabase/README.md → "Netlify setup".
// =========================================================

window.SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-ANON-PUBLIC-KEY'
};
