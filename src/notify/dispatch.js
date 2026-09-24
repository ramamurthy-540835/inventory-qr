'use strict';

const { BigQuery } = require('@google-cloud/bigquery');
const config = require('./config');
const { archiveOrder, claimNotification, releaseNotification } = require('../storage/orderArchive');
const { sendOrderWhatsApp } = require('./whatsapp');

const bq = new BigQuery({ projectId: config.project });

function isoTimestamp(value) {
  const raw = value?.value || value?.toDate?.() || value;
  const date = raw instanceof Date ? raw : new Date(raw || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/**
 * Normalise whatever the order route already has into the shape the archive
 * and templates expect. Everything is optional except order_id.
 */
function buildOrderPayload(input = {}) {
  const items = (input.items || input.order_items || []).map((i) => ({
    material_id: i.material_id || i.id || null,
    name: i.name || i.material_name || i.product_name || i.material_id || 'Item',
    quantity: Number(i.quantity ?? i.qty ?? 1),
    unit_price: String(i.unit_price ?? i.price ?? '0'),
    line_total: String(
      i.line_total ?? Number(i.unit_price ?? i.price ?? 0) * Number(i.quantity ?? i.qty ?? 1)
    ),
  }));

  const total =
    input.total_amount ??
    input.total ??
    items.reduce((s, i) => s + Number(i.line_total || 0), 0);

  return {
    order_id: input.order_id || input.orderId || input.id,
    customer_id: input.customer_id || input.customerId || null,
    customer_name: input.customer_name || input.name || null,
    customer_email: input.customer_email || input.email || null,
    customer_phone: input.customer_phone || input.phone || input.mobile || null,
    delivery_address: input.delivery_address || input.address || null,
    payment_status: input.payment_status || 'paid',
    payment_reference: input.payment_reference || input.payment_id || null,
    order_status: input.order_status || input.status || 'processing',
    placed_at: isoTimestamp(input.placed_at || input.created_at),
    total_amount: String(total),
    currency: input.currency || 'INR',
    qr_id: input.qr_id || null,
    qr_object_path: input.qr_object_path || (input.qr_id ? `qr-codes/${input.qr_id}.png` : null),
    items,
  };
}

async function logNotification(row) {
  try {
    await bq
      .dataset(config.dataset)
      .table(config.notificationTable)
      .insert([row], { ignoreUnknownValues: true });
  } catch (err) {
    // Logging must never break checkout.
    console.error('[notify] bq log failed', err.message);
  }
}

/**
 * Archive the order to GCS, then notify the customer on WhatsApp.
 * Safe to call twice for the same order: per-channel GCS markers prevent re-sends.
 *
 * @param {object} rawOrder
 * @param {object} [opts] - { force: true } bypasses the idempotency marker
 * @returns {Promise<{order_id:string, archive:object, results:Array}>}
 */
async function dispatchOrderConfirmation(rawOrder, opts = {}) {
  const order = buildOrderPayload(rawOrder);
  if (!order.order_id) throw new Error('dispatchOrderConfirmation: order_id is required');

  // 1. GCS first — the record of truth survives even if both channels fail.
  let archive = { prefix: null, objects: {}, links: {} };
  try {
    const archived = await archiveOrder(order);
    const { document_base64: documentBase64, ...archiveResult } = archived;
    archive = archiveResult;
    order.document_base64 = documentBase64;
    order.links = archive.links;
    order.gcs_prefix = archive.prefix;
  } catch (err) {
    console.error('[notify] archive failed', order.order_id, err.message);
  }

  // 2. Fan out, never throwing.
  const channels = [
    { name: 'whatsapp', run: () => sendOrderWhatsApp(order) },
  ];

  const results = await Promise.all(
    channels.map(async ({ name, run }) => {
      let claimed = false;
      try {
        if (!opts.force) {
          claimed = await claimNotification(order.order_id, name);
          if (!claimed) return { channel: name, status: 'skipped', detail: 'already sent' };
        }
        const result = await run();
        if (claimed && result.status === 'failed') await releaseNotification(order.order_id, name);
        return result;
      } catch (err) {
        if (claimed) await releaseNotification(order.order_id, name).catch(() => {});
        return { channel: name, status: 'failed', detail: err.message.slice(0, 400) };
      }
    })
  );

  // 3. Audit trail.
  const now = new Date().toISOString();
  await Promise.all(
    results.map((r) =>
      logNotification({
        notification_id: `${order.order_id}:${r.channel}:${Date.now()}`,
        order_id: order.order_id,
        customer_id: order.customer_id,
        channel: r.channel,
        recipient: order.customer_phone,
        status: r.status,
        provider_reference: r.status === 'sent' ? r.detail : null,
        error_message: r.status === 'failed' ? r.detail : null,
        gcs_prefix: archive.prefix,
        created_at: now,
      })
    )
  );

  console.log(
    '[notify]',
    order.order_id,
    results.map((r) => `${r.channel}=${r.status}`).join(' '),
    archive.prefix || 'no-archive'
  );

  return { order_id: order.order_id, archive, results };
}

module.exports = { dispatchOrderConfirmation, buildOrderPayload };
