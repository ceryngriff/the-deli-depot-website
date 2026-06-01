// =========================================================
// SEND ORDER EMAIL — Netlify Function
// Called from js/checkout.js after a successful order insert.
// Sends a confirmation via the Resend API using the
// RESEND_API_KEY environment variable.
// =========================================================
//
// To deploy: this file lands automatically when Netlify builds
// the site. The function is available at:
//   https://<your-site>.netlify.app/.netlify/functions/send-order-email
//
// For LOCAL development with `python -m http.server`, this
// endpoint does NOT exist — js/checkout.js handles that
// gracefully (logs a warning, doesn't block order creation).
// =========================================================

const FROM_ADDRESS = 'Deli Depot <orders@thedelidepot.com>';
const REPLY_TO     = 'hello@thedelidepot.com';

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

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: 'Invalid JSON' };
  }

  const { order, items } = payload;
  if (!order || !order.order_number || !order.customer_email) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing order or customer_email' })
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-order-email] RESEND_API_KEY not configured on Netlify');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Email service not configured' })
    };
  }

  // --- Build the email ---
  // Where the deli's own "new order" alert goes. Set ORDER_NOTIFY_EMAIL in
  // Netlify env vars (kept out of the repo). Falls back to the reply-to.
  const notifyTo = process.env.ORDER_NOTIFY_EMAIL || REPLY_TO;

  // Helper: send one email via Resend. Returns { ok, status, result }.
  async function send({ to, subject, html, text }) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, reply_to: REPLY_TO, subject, html, text })
    });
    const result = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, result };
  }

  try {
    // 1. Customer confirmation
    const customer = await send({
      to:      order.customer_email,
      subject: `Order ${order.order_number} confirmed — The Deli Depot`,
      html:    buildHtml(order, items || []),
      text:    buildText(order, items || [])
    });
    if (!customer.ok) console.error('[send-order-email] customer email rejected:', customer.status, customer.result);

    // 2. Deli's own new-order alert
    let deli = { ok: false };
    if (notifyTo) {
      deli = await send({
        to:      notifyTo,
        subject: `🛎 New order ${order.order_number} — ${order.customer_name || 'Guest'}`,
        html:    buildDeliHtml(order, items || []),
        text:    buildDeliText(order, items || [])
      });
      if (!deli.ok) console.error('[send-order-email] deli alert rejected:', deli.status, deli.result);
    }

    // The order already exists in Supabase, so never fail the request — just
    // report what happened with each email.
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: customer.ok && deli.ok,
        customerEmailSent: customer.ok,
        deliAlertSent: deli.ok,
        customerEmailId: customer.result?.id,
        deliAlertId: deli.result?.id
      })
    };
  } catch (err) {
    console.error('[send-order-email] Network error:', err);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, emailFailed: true, error: String(err) })
    };
  }
};

// ---------- TEMPLATES ----------

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function bundleLabel(b) {
  switch (b) {
    case 'single':         return 'Single Meal';
    case 'bundle_5':       return '5 Pack';
    case 'bundle_10':      return '10 Pack';
    case 'build_your_own': return 'Build Your Own';
    default:               return b || '';
  }
}

function formatCollection(iso) {
  if (!iso) return 'TBC';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function buildHtml(order, items) {
  const collection = formatCollection(order.collection_slot);
  const total = parseFloat(order.total || 0).toFixed(2);
  const subtotal = parseFloat(order.subtotal || order.total || 0).toFixed(2);

  const itemsHtml = items.length
    ? items.map((it) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2d2a26;color:#f5f1e8;font-family:Montserrat,Arial,sans-serif;">
            <strong>${escapeHtml(it.meal_name)}</strong><br/>
            <span style="color:#a8a39a;font-size:13px;">${escapeHtml(bundleLabel(it.bundle_type))} · ×${it.quantity}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #2d2a26;color:#c9a961;text-align:right;font-family:Montserrat,Arial,sans-serif;white-space:nowrap;">£${parseFloat(it.line_total || 0).toFixed(2)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="2" style="padding:14px 0;color:#a8a39a;text-align:center;">(No items listed)</td></tr>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Montserrat,Arial,sans-serif;color:#f5f1e8;">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f0f0f;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#1a1a1a;border:1px solid #2d2a26;border-radius:14px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:36px 32px 24px;text-align:center;border-bottom:1px solid #2d2a26;">
              <p style="margin:0;font-size:11px;letter-spacing:0.38em;color:#f5f1e8;text-transform:uppercase;font-weight:600;">DELI</p>
              <p style="margin:0;font-size:36px;color:#c9a961;font-family:'Brush Script MT',cursive,Georgia,serif;line-height:1;">Depot</p>
              <p style="margin:18px 0 0;color:#a8a39a;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Order Confirmed</p>
              <p style="margin:8px 0 0;color:#c9a961;font-size:20px;font-weight:600;letter-spacing:0.05em;">${escapeHtml(order.order_number)}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;color:#f5f1e8;font-size:16px;">Thanks ${escapeHtml(order.customer_name || 'there')},</p>
              <p style="margin:8px 0 0;color:#d8d2c4;font-size:14px;line-height:1.6;">
                We've got your order. Collect from <strong style="color:#f5f1e8;">Unit 5, Pant Industrial Estate, Merthyr Tydfil</strong> at the slot below.
              </p>
            </td>
          </tr>

          <!-- Collection block -->
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#222020;border:1px solid #2d2a26;border-radius:10px;padding:18px 22px;margin:12px 0;">
                <tr>
                  <td>
                    <p style="margin:0;color:#c9a961;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">Collection</p>
                    <p style="margin:6px 0 16px;color:#f5f1e8;font-size:16px;">${escapeHtml(collection)}</p>
                    <p style="margin:0;color:#c9a961;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">Total</p>
                    <p style="margin:6px 0 16px;color:#c9a961;font-size:22px;font-weight:600;">£${total}</p>
                    <p style="margin:0;color:#c9a961;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">Payment</p>
                    <p style="margin:6px 0 0;color:#f5f1e8;font-size:14px;">On collection — cash or card.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:18px 0 12px;color:#c9a961;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">Your Items</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${itemsHtml}
                <tr>
                  <td style="padding:14px 0 0;color:#f5f1e8;font-family:Montserrat,Arial,sans-serif;font-size:14px;"><strong>Subtotal</strong></td>
                  <td style="padding:14px 0 0;text-align:right;color:#f5f1e8;font-family:Montserrat,Arial,sans-serif;">£${subtotal}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0 0;color:#c9a961;font-family:Montserrat,Arial,sans-serif;font-size:16px;"><strong>Total</strong></td>
                  <td style="padding:6px 0 0;text-align:right;color:#c9a961;font-family:Montserrat,Arial,sans-serif;font-size:18px;font-weight:600;">£${total}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${order.notes ? `
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0 0 6px;color:#c9a961;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">Your Note</p>
              <p style="margin:0;color:#d8d2c4;font-size:14px;line-height:1.5;">${escapeHtml(order.notes)}</p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #2d2a26;text-align:center;">
              <p style="margin:0;color:#a8a39a;font-size:12px;line-height:1.6;">
                Questions or need to change anything? Reply to this email and we'll sort it.<br/>
                The Deli Depot · Unit 5, Pant Industrial Estate · Merthyr Tydfil
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

function buildText(order, items) {
  const collection = formatCollection(order.collection_slot);
  const total = parseFloat(order.total || 0).toFixed(2);

  const lines = [];
  lines.push('THE DELI DEPOT');
  lines.push('Order Confirmed');
  lines.push('');
  lines.push(`Order: ${order.order_number}`);
  lines.push(`Hi ${order.customer_name || 'there'},`);
  lines.push('');
  lines.push('We\'ve got your order. Collect from Unit 5, Pant Industrial Estate, Merthyr Tydfil at the slot below.');
  lines.push('');
  lines.push(`Collection: ${collection}`);
  lines.push(`Total: £${total}`);
  lines.push('Payment: On collection — cash or card.');
  lines.push('');
  lines.push('Items:');
  items.forEach((it) => {
    lines.push(`  · ${it.meal_name} (${bundleLabel(it.bundle_type)} × ${it.quantity}) — £${parseFloat(it.line_total || 0).toFixed(2)}`);
  });
  lines.push('');
  if (order.notes) {
    lines.push(`Your note: ${order.notes}`);
    lines.push('');
  }
  lines.push('Questions? Reply to this email.');
  lines.push('');
  lines.push('The Deli Depot');
  lines.push('Unit 5, Pant Industrial Estate, Merthyr Tydfil');
  return lines.join('\n');
}

// ---------- DELI NOTIFICATION (sent to the shop, not the customer) ----------

function buildDeliHtml(order, items) {
  const collection = formatCollection(order.collection_slot);
  const total = parseFloat(order.total || 0).toFixed(2);
  const itemsHtml = (items.length ? items : []).map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #ddd;">
        <strong>${escapeHtml(it.meal_name)}</strong> — ${escapeHtml(bundleLabel(it.bundle_type))} &times; ${it.quantity}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap;">£${parseFloat(it.line_total || 0).toFixed(2)}</td>
    </tr>`).join('') || `<tr><td colspan="2" style="padding:8px 0;color:#a00;">(No items recorded)</td></tr>`;

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;">
    <h2 style="margin:0 0 4px;">New order: ${escapeHtml(order.order_number)}</h2>
    <p style="margin:0 0 16px;color:#555;">Collection: <strong>${escapeHtml(collection)}</strong></p>

    <h3 style="margin:16px 0 6px;">Customer</h3>
    <p style="margin:0;line-height:1.6;">
      ${escapeHtml(order.customer_name || 'Guest')}<br/>
      Phone: <a href="tel:${escapeHtml(order.customer_phone || '')}">${escapeHtml(order.customer_phone || '—')}</a><br/>
      Email: <a href="mailto:${escapeHtml(order.customer_email || '')}">${escapeHtml(order.customer_email || '—')}</a>
    </p>

    <h3 style="margin:18px 0 6px;">Items</h3>
    <table cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">${itemsHtml}
      <tr><td style="padding:10px 0 0;"><strong>Total</strong></td>
          <td style="padding:10px 0 0;text-align:right;"><strong>£${total}</strong></td></tr>
    </table>
    ${order.notes ? `<h3 style="margin:18px 0 6px;">Customer note</h3><p style="margin:0;">${escapeHtml(order.notes)}</p>` : ''}
    <p style="margin:22px 0 0;color:#888;font-size:12px;">Payment due on collection. Manage this order in your admin dashboard.</p>
  </body></html>`;
}

function buildDeliText(order, items) {
  const lines = [];
  lines.push(`NEW ORDER: ${order.order_number}`);
  lines.push(`Collection: ${formatCollection(order.collection_slot)}`);
  lines.push('');
  lines.push(`Customer: ${order.customer_name || 'Guest'}`);
  lines.push(`Phone:    ${order.customer_phone || '—'}`);
  lines.push(`Email:    ${order.customer_email || '—'}`);
  lines.push('');
  lines.push('Items:');
  (items.length ? items : []).forEach((it) => {
    lines.push(`  · ${it.meal_name} (${bundleLabel(it.bundle_type)} × ${it.quantity}) — £${parseFloat(it.line_total || 0).toFixed(2)}`);
  });
  if (!items.length) lines.push('  (No items recorded)');
  lines.push('');
  lines.push(`Total: £${parseFloat(order.total || 0).toFixed(2)} (due on collection)`);
  if (order.notes) { lines.push(''); lines.push(`Customer note: ${order.notes}`); }
  return lines.join('\n');
}
