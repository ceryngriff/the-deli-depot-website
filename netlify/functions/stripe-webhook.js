// =========================================================
// STRIPE WEBHOOK — Netlify Function
// Receives payment events from Stripe and reconciles the order's
// payment_status in Supabase. This is the SOURCE OF TRUTH for
// payment state — never trust the browser to mark an order paid.
// =========================================================
//
// Deployed at:
//   https://<your-site>.netlify.app/.netlify/functions/stripe-webhook
// Register that URL in Stripe Dashboard → Developers → Webhooks and
// subscribe to: payment_intent.succeeded, payment_intent.payment_failed.
//
// REQUIRED ENVIRONMENT VARIABLES (set in the Netlify dashboard):
//   STRIPE_SECRET_KEY          — Stripe Dashboard → Developers → API keys
//   STRIPE_WEBHOOK_SECRET      — Stripe Dashboard → Webhooks → (this endpoint)
//                                signing secret (whsec_…)
//   SUPABASE_URL               — same value as window.SUPABASE_CONFIG.url
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase Dashboard → Project Settings → API
//                                (the SECRET service_role key — bypasses RLS,
//                                 NEVER expose this in the browser)
// =========================================================

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const secretKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  const stripe = Stripe(secretKey);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  // Stripe signature verification needs the EXACT raw bytes. Netlify may
  // base64-encode the body, so decode it back to the original string first.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // ---------- HANDLE EVENTS ----------
  try {
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded': {
        const intent = stripeEvent.data.object;
        await updateOrderPayment(intent.metadata?.order_id, {
          payment_status: 'paid',
          status:         'confirmed'
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = stripeEvent.data.object;
        await updateOrderPayment(intent.metadata?.order_id, {
          payment_status: 'failed'
        });
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries — the order update is important and a
    // transient Supabase blip shouldn't silently drop a paid order.
    console.error('[stripe-webhook] Failed to process event:', stripeEvent.type, err);
    return { statusCode: 500, body: 'Failed to process event' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// Update the order row using the service-role key (bypasses RLS).
async function updateOrderPayment(orderId, fields) {
  if (!orderId) {
    console.warn('[stripe-webhook] event had no order_id in metadata — skipping');
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { error } = await supabase
    .from('orders')
    .update(fields)
    .eq('id', orderId);

  if (error) throw error;
  console.log(`[stripe-webhook] order ${orderId} →`, fields);
}
