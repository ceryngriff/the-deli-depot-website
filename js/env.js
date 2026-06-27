// =========================================================
// SUPABASE CONFIG
// =========================================================
// Holds the project URL + PUBLISHABLE (anon) key. This key is
// designed to be exposed in the browser — it only permits what
// Row Level Security allows, so it is safe to commit to the repo.
// (The secret service_role key is NEVER used in this codebase.)
//
// To point the site at a different Supabase project, change the
// two values below. Netlify snippet injection can still override
// this at deploy time if you ever prefer to keep keys out of git.
// =========================================================

window.SUPABASE_CONFIG = {
  url: 'https://wcfvnlntkhpnokrejljl.supabase.co',
  anonKey: 'sb_publishable_0-zClgevOpdbSC3T7HIXmg_LPgkW2VQ'
};

// =========================================================
// STRIPE PUBLISHABLE KEY
// =========================================================
// Safe to expose in the browser (it can only create payments,
// not read or refund them). REPLACE the placeholder below with
// the real publishable key from:
//   Stripe Dashboard → Developers → API keys  (pk_live_… / pk_test_…)
// The matching SECRET key lives only in Netlify env vars
// (STRIPE_SECRET_KEY) and is never committed here.
// =========================================================
window.STRIPE_PUBLISHABLE_KEY = 'pk_live_51TgxPiHWuCBxPY85jVRsInobmBiVrDOcwRHGirUvPlcnaGgizEJ0S0K0PqumJvLnetFgk8x8XyVmHTxyBJB71a2W00TaM81Ue2';
