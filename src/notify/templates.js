'use strict';

const config = require('./config');

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const inr = (v) => {
  const n = Number(v || 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const when = (iso) =>
  new Date(iso || Date.now()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

function itemRows(items = []) {
  if (!items.length) {
    return `<tr><td colspan="4" style="padding:12px;color:#6b7280;">Item detail available in your account.</td></tr>`;
  }
  return items
    .map(
      (i) => `<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(i.name || i.material_name || i.material_id)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${esc(i.quantity ?? i.qty ?? 1)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${inr(i.unit_price ?? i.price)}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${inr(
    i.line_total ?? Number(i.unit_price ?? i.price ?? 0) * Number(i.quantity ?? i.qty ?? 1)
  )}</td>
</tr>`
    )
    .join('\n');
}

/** Full HTML receipt — used for both the email body and the GCS receipt.html object. */
function receiptHtml(order) {
  const b = config.brand;
  const trackUrl = order.links?.receipt || config.appUrl;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Order ${esc(order.order_id)}</title></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <tr><td style="padding:24px;background:#0f172a;color:#ffffff;">
    <div style="font-size:18px;font-weight:700;">${esc(b.name)}</div>
    <div style="font-size:13px;opacity:.8;margin-top:4px;">Order confirmation</div>
  </td></tr>
  <tr><td style="padding:24px;">
    <p style="margin:0 0 4px;font-size:16px;">Hi ${esc(order.customer_name || 'there')},</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">
      Your payment has been received and your order is now being processed.
    </p>

    <table role="presentation" width="100%" style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:18px;">
      <tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Order ID</td>
          <td style="font-size:13px;text-align:right;font-weight:600;">${esc(order.order_id)}</td></tr>
      <tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Placed on</td>
          <td style="font-size:13px;text-align:right;">${esc(when(order.placed_at))}</td></tr>
      <tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Payment</td>
          <td style="font-size:13px;text-align:right;color:#047857;font-weight:600;">${esc(
            (order.payment_status || 'paid').toUpperCase()
          )}</td></tr>
      ${order.qr_id ? `<tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">QR ID</td>
          <td style="font-size:13px;text-align:right;font-family:monospace;">${esc(order.qr_id)}</td></tr>` : ''}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <thead><tr>
        <th align="left" style="padding:8px;border-bottom:2px solid #111827;font-size:12px;text-transform:uppercase;letter-spacing:.04em;">Item</th>
        <th align="center" style="padding:8px;border-bottom:2px solid #111827;font-size:12px;">Qty</th>
        <th align="right" style="padding:8px;border-bottom:2px solid #111827;font-size:12px;">Rate</th>
        <th align="right" style="padding:8px;border-bottom:2px solid #111827;font-size:12px;">Amount</th>
      </tr></thead>
      <tbody>${itemRows(order.items)}</tbody>
      <tfoot>
        <tr><td colspan="3" align="right" style="padding:10px 8px;font-weight:700;">Total paid</td>
            <td align="right" style="padding:10px 8px;font-weight:700;">${inr(order.total_amount)}</td></tr>
      </tfoot>
    </table>

    ${order.links?.qr ? `<div style="text-align:center;margin:22px 0;">
      <img src="${esc(order.links.qr)}" alt="Order QR" width="150" height="150" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#fff;">
      <div style="font-size:12px;color:#6b7280;margin-top:6px;">Show this QR at pickup / delivery</div></div>` : ''}

    <div style="text-align:center;margin:22px 0 6px;">
      <a href="${esc(trackUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">View your order</a>
    </div>
  </td></tr>
  <tr><td style="padding:18px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;">
    Questions? Reply to this email or write to ${esc(b.supportEmail)}.<br>
    ${esc(b.name)} · ${esc(b.address)}
  </td></tr>
</table>
</body></html>`;
}

function receiptText(order) {
  const lines = [
    `${config.brand.name} — order confirmed`,
    '',
    `Hi ${order.customer_name || 'there'}, payment received. Your order is being processed.`,
    '',
    `Order ID : ${order.order_id}`,
    `Placed   : ${when(order.placed_at)}`,
    `Total    : ${inr(order.total_amount)}`,
  ];
  if (order.qr_id) lines.push(`QR ID    : ${order.qr_id}`);
  (order.items || []).forEach((i) =>
    lines.push(`  - ${i.name || i.material_id} x${i.quantity ?? 1}  ${inr(i.line_total ?? i.unit_price)}`)
  );
  lines.push('', `Track: ${order.links?.receipt || config.appUrl}`, '', `Support: ${config.brand.supportEmail}`);
  return lines.join('\n');
}

const emailSubject = (order) => `Order confirmed — ${order.order_id} · ${config.brand.name}`;

/**
 * WhatsApp template body parameters, in order.
 * Template registered with Meta must be:
 *   "Hi {{1}}, your {{2}} order {{3}} is confirmed. Amount paid: {{4}}. We'll notify you when it's out for delivery."
 */
function whatsappParams(order) {
  return [
    String(order.customer_name || 'there').slice(0, 60),
    config.brand.name,
    String(order.order_id),
    inr(order.total_amount).replace('₹', 'Rs '), // Meta rejects some currency glyphs in params
  ].map((text) => ({ type: 'text', text }));
}

module.exports = { receiptHtml, receiptText, emailSubject, whatsappParams, inr, esc };
