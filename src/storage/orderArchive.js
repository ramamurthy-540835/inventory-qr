'use strict';

const { Storage } = require('@google-cloud/storage');
const config = require('../notify/config');
const { receiptHtml } = require('../notify/templates');
const { generate80gPdf } = require('./80gDocument');

const storage = new Storage({ projectId: config.project });
const bucket = () => storage.bucket(config.bucket);

// orders/YYYY/MM/DD/<order_id>/...
function orderPrefix(orderId, when = new Date()) {
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  return `orders/${y}/${m}/${d}/${orderId}`;
}

async function writeObject(path, body, contentType, metadata = {}) {
  const file = bucket().file(path);
  await file.save(body, {
    resumable: false,
    contentType,
    metadata: { cacheControl: 'private, max-age=0, no-transform', metadata },
  });
  return `gs://${config.bucket}/${path}`;
}

async function signedUrl(path, days = config.archive.signedUrlDays) {
  try {
    const [url] = await bucket()
      .file(path)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + days * 24 * 60 * 60 * 1000,
      });
    return url;
  } catch (err) {
    // Signing needs roles/iam.serviceAccountTokenCreator on the runtime SA.
    console.error('[archive] signed url failed', path, err.message);
    return null;
  }
}

async function exists(path) {
  try {
    const [ok] = await bucket().file(path).exists();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Persist everything about a paid order to GCS.
 * @param {object} order - normalised order payload (see dispatch.buildOrderPayload)
 * @returns {Promise<{prefix:string, objects:object, links:object}>}
 */
async function archiveOrder(order) {
  if (!config.archive.enabled) return { prefix: null, objects: {}, links: {} };

  const placedAt = order.placed_at ? new Date(order.placed_at) : new Date();
  const prefix = orderPrefix(order.order_id, placedAt);

  const meta = {
    order_id: order.order_id,
    customer_id: order.customer_id || '',
    payment_status: order.payment_status || 'paid',
  };

  const objects = {};
  const tasks = [];
  const documentPdf = await generate80gPdf(order);

  // 1. Canonical order record (immutable snapshot, money as strings)
  tasks.push(
    writeObject(
      `${prefix}/order.json`,
      JSON.stringify(order, null, 2),
      'application/json; charset=utf-8',
      meta
    ).then((uri) => (objects.order = uri))
  );

  // 2. Human-readable receipt (same HTML sent by email)
  tasks.push(
    writeObject(
      `${prefix}/receipt.html`,
      receiptHtml(order),
      'text/html; charset=utf-8',
      meta
    ).then((uri) => (objects.receipt = uri))
  );

  tasks.push(
    writeObject(`${prefix}/80g.pdf`, documentPdf, 'application/pdf', meta).then((uri) => (objects.document = uri))
  );

  // 3. QR PNG — copy the existing qr-codes/ object into the order folder if present
  if (order.qr_object_path) {
    tasks.push(
      bucket()
        .file(order.qr_object_path)
        .copy(bucket().file(`${prefix}/qr.png`))
        .then(() => {
          objects.qr = `gs://${config.bucket}/${prefix}/qr.png`;
        })
        .catch((err) => console.error('[archive] qr copy failed', err.message))
    );
  } else if (order.qr_png_base64) {
    tasks.push(
      writeObject(`${prefix}/qr.png`, Buffer.from(order.qr_png_base64, 'base64'), 'image/png', meta).then(
        (uri) => (objects.qr = uri)
      )
    );
  }

  await Promise.all(tasks);

  const links = {
    receipt: await signedUrl(`${prefix}/receipt.html`),
    document: await signedUrl(`${prefix}/80g.pdf`),
    qr: objects.qr ? await signedUrl(`${prefix}/qr.png`) : null,
  };

  return { prefix, objects, links, document_base64: documentPdf.toString('base64') };
}

/** Idempotency marker so a retried webhook never double-sends. */
async function claimNotification(orderId, channel) {
  const path = `orders/_sent/${orderId}/${channel}.json`;
  const file = bucket().file(path);
  try {
    await file.save(JSON.stringify({ orderId, channel, at: new Date().toISOString() }), {
      resumable: false,
      contentType: 'application/json',
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    return true;
  } catch (err) {
    if (err.code === 412 || (await exists(path))) return false;
    throw err;
  }
}

async function releaseNotification(orderId, channel) {
  await bucket().file(`orders/_sent/${orderId}/${channel}.json`).delete({ ignoreNotFound: true });
}

module.exports = { archiveOrder, claimNotification, releaseNotification, signedUrl, orderPrefix, writeObject, exists };
