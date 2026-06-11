// =========================================================
// CREATE PAYMENT INTENT — Netlify Function
// Called from js/checkout.js after the order row is inserted.
// Creates a Stripe PaymentIntent for the order total and hands
// the client_secret back to the browser so Stripe Elements can
// confirm the card payment.
// =========================================================
//
// Deployed at:
//   https://<your-site>.netlify.app/.netlify/functions/create-payment-intent
//
// For LOCAL development with a static server this endpoint does
// NOT exist — js/checkout.js surfaces a clear error in that case.
//
// REQUIRED ENVIRONMENT VARIABLES (set in the Netlify dashboard):
//   STRIPE_SECRET_KEY  — Stripe Dashboard → Developers → API keys
//                        (the secret key, sk_live_… / sk_test_…)
//
// The matching publishable key (pk_live_… / pk_test_…) lives on the
// frontend in js/env.js as window.STRIPE_PUBLISHABLE_KEY.
// =========================================================

const Stripe = require('stripe');

exports.handler = async (event) => {
  // Allow same-origin POST + CORS preflight from the deployed site
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[create-payment-intent] STRIPE_SECRET_KEY not configured on Netlify');
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

  const { orderId, orderNumber, amountPence, customerEmail, customerName } = payload;

  // Validate the amount — must be a positive integer number of pence.
  const amount = Number(amountPence);
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid payment amount' })
    };
  }
  if (!orderId || !orderNumber) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing order details' })
    };
  }

  const stripe = Stripe(secretKey);

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'gbp',
      metadata: {
        order_id:     String(orderId),
        order_number: String(orderNumber)
      },
      receipt_email: customerEmail || undefined,
      description:   `Deli Depot order ${orderNumber}`,
      automatic_payment_methods: { enabled: true }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ clientSecret: intent.client_secret })
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
