// =========================================================
// CREATE PAYMENT INTENT — Netlify Function
// Called from js/checkout.js after the order row is inserted.
// Creates a Stripe PaymentIntent for the order total and hands
// the client_secret back to the browser so Stripe Elements can
// confirm the card payment.
//
// SECURITY: the charge amount is read from the order row in Supabase
// (orders.total), NOT from the browser. The amount the client sends is
// only a display hint — it is never trusted. This closes the hole where a
// tampered request could pay an arbitrary amount.
// =========================================================
//
// Deployed at:
//   https://<your-site>.netlify.app/.netlify/functions/create-payment-intent
//
// For LOCAL development with a static server this endpoint does
// NOT exist — js/checkout.js surfaces a clear error in that case.
//
// REQUIRED ENVIRONMENT VARIABLES (set in the Netlify dashboard):
//   STRIPE_SECRET_KEY          — Stripe Dashboard → Developers → API keys
//                                (the secret key, sk_live_… / sk_test_…)
//   SUPABASE_URL               — same value as window.SUPABASE_CONFIG.url
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase → Project Settings → API (secret;
//                                bypasses RLS, NEVER expose in the browser)
//   ALLOWED_ORIGIN  (optional) — comma-separated allow-list for CORS.
//                                Defaults to the deli's own domains.
//
// The matching publishable key (pk_live_… / pk_test_…) lives on the
// frontend in js/env.js as window.STRIPE_PUBLISHABLE_KEY.
// =========================================================

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Reflect the request Origin only if it's on our allow-list; otherwise pin to
// the primary domain. Prevents arbitrary third-party sites from calling this.
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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

exports.handler = async (event) => {
  const corsHeaders = corsHeadersFor(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
  }

  const secretKey  = process.env.STRIPE_SECRET_KEY;
  const supaUrl    = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supaUrl || !serviceKey) {
    console.error('[create-payment-intent] missing STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Payment service not configured' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { orderId, customerEmail, customerName } = payload;
  if (!orderId) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing order id' }) };
  }

  // ---- Look the order up SERVER-SIDE and charge ITS total. ----
  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, total, payment_status')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    console.error('[create-payment-intent] order not found', orderId, orderErr);
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Order not found' }) };
  }
  if (order.payment_status === 'paid') {
    return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ error: 'Order already paid' }) };
  }

  const amount = Math.round(Number(order.total) * 100);
  if (!Number.isInteger(amount) || amount <= 0) {
    console.error('[create-payment-intent] order has invalid total', orderId, order.total);
    return { statusCode: 422, headers: corsHeaders, body: JSON.stringify({ error: 'Order total is invalid' }) };
  }

  const stripe = Stripe(secretKey);

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'gbp',
      metadata: {
        order_id:     String(order.id),
        order_number: String(order.order_number)
      },
      receipt_email: customerEmail || undefined,
      description:   `Deli Depot order ${order.order_number}`,
      automatic_payment_methods: { enabled: true }
    }, {
      // Idempotent per order: retries (button re-press, network retry) reuse
      // the same PaymentIntent instead of creating duplicates.
      idempotencyKey: `order-${order.id}`
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ clientSecret: intent.client_secret, amountPence: amount })
    };
  } catch (err) {
    console.error('[create-payment-intent] Stripe error:', err);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Could not start payment' })
    };
  }
};
