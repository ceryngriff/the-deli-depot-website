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
