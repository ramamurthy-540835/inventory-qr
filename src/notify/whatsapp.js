'use strict';

const config = require('./config');
const { whatsappParams } = require('./templates');

/**
 * Normalise an Indian mobile number to the digits-only E.164 form Meta expects.
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
  return d;
}

async function postToMeta(body) {
  const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
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
 * Business-initiated messages must use an approved template (the 24h session
 * window does not apply to a fresh order confirmation).
 * @returns {Promise<{channel:'whatsapp', status:'sent'|'skipped'|'failed', detail:string}>}
 */
async function sendOrderWhatsApp(order) {
  if (!config.whatsapp.configured) {
    return { channel: 'whatsapp', status: 'skipped', detail: 'wa not configured' };
  }

  const to = toE164(order.customer_phone);
  if (!to) return { channel: 'whatsapp', status: 'skipped', detail: 'no valid phone' };

  const components = [{ type: 'body', parameters: whatsappParams(order) }];

  // Optional button that deep-links to the order page, if the approved template
  // carries a dynamic URL button at index 0.
  if (order.links?.receipt && config.whatsapp.template.includes('_btn')) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: order.order_id }],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: config.whatsapp.template,
      language: { code: config.whatsapp.lang },
      components,
    },
  };

  try {
    const json = await postToMeta(payload);
    const id = json?.messages?.[0]?.id || 'ok';
    return { channel: 'whatsapp', status: 'sent', detail: id };
  } catch (err) {
    console.error('[whatsapp] send failed', order.order_id, err.message);
    return { channel: 'whatsapp', status: 'failed', detail: err.message.slice(0, 400) };
  }
}

module.exports = { sendOrderWhatsApp, toE164 };
