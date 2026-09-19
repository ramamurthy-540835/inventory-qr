'use strict';

const config = require('./config');

/**
 * Normalise an Indian mobile number to the E.164 form OpenClaw expects.
 * "+91 98765 43210" / "098765 43210" / "9876543210" -> "919876543210"
 */
function toE164(raw, cc = config.whatsapp.defaultCountryCode) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10) d = cc + d;                 // bare local number
  else if (d.length === 11 && d.startsWith('0')) d = cc + d.slice(1);
  else if (d.length === 12 && d.startsWith(cc)) { /* already correct */ }
  if (d.length < 11 || d.length > 15) return null;
  return `+${d}`;
}

async function postToOpenClaw(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(config.openclaw.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openclaw.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.meta = json?.error || null;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenClaw sends the generated 80G PDF as an attached WhatsApp document.
 * @returns {Promise<{channel:'whatsapp', status:'sent'|'skipped'|'failed', detail:string}>}
 */
async function sendOrderWhatsApp(order) {
  if (!config.whatsapp.configured) {
    return { channel: 'whatsapp', status: 'skipped', detail: 'openclaw not configured' };
  }

  const to = toE164(order.customer_phone);
  if (!to) return { channel: 'whatsapp', status: 'skipped', detail: 'no valid phone' };
  if (!order.document_base64) return { channel: 'whatsapp', status: 'failed', detail: '80G PDF was not generated' };

  const payload = {
    to,
    filename: `80G-${order.order_id}.pdf`,
    pdf_base64: order.document_base64,
    caption: `Your order ${order.order_id} is confirmed and paid. Your 80G document is attached. Amount paid: Rs ${order.total_amount}.`,
  };

  try {
    const json = await postToOpenClaw(payload);
    const id = json?.status || 'accepted';
    return { channel: 'whatsapp', status: 'sent', detail: id };
  } catch (err) {
    console.error('[whatsapp] send failed', order.order_id, err.message);
    return { channel: 'whatsapp', status: 'failed', detail: err.message.slice(0, 400) };
  }
}

module.exports = { sendOrderWhatsApp, toE164 };
