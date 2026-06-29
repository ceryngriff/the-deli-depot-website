// =========================================================
// SEND COLLECTION-READY SMS — Netlify Function
// Texts a customer that their order is ready to collect.
// Called from the admin Orders page ("Send Collection-Ready SMS").
//
// SECURITY:
//  - The caller MUST be a signed-in admin. The admin's Supabase access
//    token is sent as a Bearer header and verified here server-side
//    (their profile.role must be 'admin'). This stops anyone who knows an
//    order id from triggering paid-for texts.
//  - The phone number is read from the order row in Supabase server-side,
//    never taken from the browser.
//
// REQUIRED ENVIRONMENT VARIABLES (set in the Netlify dashboard):
//   SUPABASE_URL               — same value as window.SUPABASE_CONFIG.url
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase → Project Settings → API (secret)
//   TWILIO_ACCOUNT_SID         — Twilio Console (starts AC…)
//   TWILIO_AUTH_TOKEN          — Twilio Console (secret)
//   …and ONE sender, either:
//   TWILIO_MESSAGING_SERVICE_SID — preferred (MG…), or
//   TWILIO_FROM                  — a Twilio number (+44…) or, in the UK, an
//                                  alphanumeric sender id e.g. "DeliDepot"
//                                  (one-way only; customer can't reply).
//
// Uses the Twilio REST API directly via fetch, so no extra npm dependency.
// =========================================================

const { createClient } = require('@supabase/supabase-js');

// Reflect the request Origin only if it's on our allow-list; otherwise pin to
// the primary domain. Matches the other functions' CORS handling.
function corsHeadersFor(event) {
  const allowed = (process.env.ALLOWED_ORIGIN ||
    'https://thedelidepot.com,https://www.thedelidepot.com')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const origin = event.headers.origin || event.headers.Origin || '';
  const allow = allowed.includes(origin) ? origin
    : (origin.endsWith('.netlify.app') ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

// Normalise a UK phone number to E.164 (+44…). Leaves already-international
// (+…) numbers untouched. Returns null if it can't make sense of it.
function toE164(raw) {
  let p = String(raw || '').replace(/[\s()\-.]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) return '+44' + p.slice(1);          // 07… → +447…
  if (/^\d{10,11}$/.test(p)) return '+44' + p;               // bare national
  return null;
}

function json(statusCode, headers, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  const cors = corsHeadersFor(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  const supaUrl     = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const twSid       = process.env.TWILIO_ACCOUNT_SID;
  const twToken     = process.env.TWILIO_AUTH_TOKEN;
  const twService   = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const twFrom      = process.env.TWILIO_FROM;

  if (!supaUrl || !serviceKey) {
    console.error('[send-sms] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
    return json(500, cors, { error: 'Server not configured' });
  }
  if (!twSid || !twToken || (!twService && !twFrom)) {
    console.error('[send-sms] Twilio env vars not configured (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM)');
    return json(500, cors, { error: 'SMS service not configured yet' });
  }

  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // ---- Verify the caller is a signed-in admin. ----
  const authHeader  = event.headers.authorization || event.headers.Authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json(401, cors, { error: 'Not signed in' });

  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user) return json(401, cors, { error: 'Session invalid — sign in again' });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userData.user.id).single();
  if (!profile || profile.role !== 'admin') return json(403, cors, { error: 'Admins only' });

  // ---- Parse the request. ----
  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, cors, { error: 'Invalid JSON' }); }

  const { orderId } = payload;
  if (!orderId) return json(400, cors, { error: 'Missing order id' });

  // ---- Read the order server-side and text the number ON the order. ----
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone')
    .eq('id', orderId)
    .single();
  if (orderErr || !order) return json(404, cors, { error: 'Order not found' });

  const to = toE164(order.customer_phone);
  if (!to) return json(422, cors, { error: 'No valid mobile number on this order' });

  const firstName = (order.customer_name || '').trim().split(/\s+/)[0] || 'there';
  const body = `Hi ${firstName}, your Deli Depot order ${order.order_number} is ready to collect from Unit 5, Pant Industrial Estate, Merthyr Tydfil. Thanks!`;

  // ---- Send via the Twilio REST API (form-encoded, HTTP Basic auth). ----
  const params = new URLSearchParams();
  params.set('To', to);
  if (twService) params.set('MessagingServiceSid', twService);
  else params.set('From', twFrom);
  params.set('Body', body);

  const basic = Buffer.from(`${twSid}:${twToken}`).toString('base64');

  let resp, data;
  try {
    resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Messages.json`, {
      method:  'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString()
    });
    data = await resp.json().catch(() => ({}));
  } catch (err) {
    console.error('[send-sms] could not reach Twilio:', err);
    return json(502, cors, { error: 'Could not reach the SMS provider' });
  }

  if (!resp.ok) {
    console.error('[send-sms] Twilio rejected the message:', resp.status, data);
    return json(502, cors, { error: data.message || 'SMS provider rejected the message' });
  }

  console.log(`[send-sms] order ${order.order_number} → texted ${to} (sid ${data.sid})`);
  return json(200, cors, { ok: true, to, sid: data.sid });
};
