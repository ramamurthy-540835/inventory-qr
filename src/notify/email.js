'use strict';

const config = require('./config');
const { receiptHtml, receiptText, emailSubject } = require('./templates');

let transport = null;

function getTransport() {
  if (transport) return transport;
  // Lazy require so the app still boots if nodemailer isn't installed yet.
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.pass },
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    pool: true,
    maxConnections: 3,
  });
  return transport;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * @returns {Promise<{channel:'email', status:'sent'|'skipped'|'failed', detail:string}>}
 */
async function sendOrderEmail(order) {
  const to = (order.customer_email || '').trim();

  if (!config.email.configured) return { channel: 'email', status: 'skipped', detail: 'smtp not configured' };
  if (!to || !EMAIL_RE.test(to)) return { channel: 'email', status: 'skipped', detail: 'no valid recipient' };

  try {
    const info = await getTransport().sendMail({
      from: config.email.from,
      to,
      bcc: config.email.bcc || undefined,
      replyTo: config.email.replyTo,
      subject: emailSubject(order),
      text: receiptText(order),
      html: receiptHtml(order),
      headers: { 'X-Order-Id': order.order_id },
    });
    return { channel: 'email', status: 'sent', detail: info.messageId || 'ok' };
  } catch (err) {
    console.error('[email] send failed', order.order_id, err.message);
    return { channel: 'email', status: 'failed', detail: err.message.slice(0, 400) };
  }
}

module.exports = { sendOrderEmail };
