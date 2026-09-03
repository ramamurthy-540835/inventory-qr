import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import QRCode from 'qrcode';
import crypto from 'node:crypto';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'customer-grocery-507211';
const datasetId = 'inventory_management';
const bucketName = process.env.GCS_BUCKET || `${projectId}-inventory-management`;
const bq = new BigQuery({ projectId });
const storage = new Storage({ projectId });
const app = express();

const table = name => `\`${projectId}.${datasetId}.${name}\``;
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const fail = (res, status, message) => res.status(status).json({ error: message });
const unitOk = value => ['KG', 'GRAM', 'LITRE', 'PIECE'].includes(value);
const statusOk = (value, choices) => choices.includes(value);
async function rows(query, params = {}) { return (await bq.query({ query, params, location: 'asia-south1' }))[0]; }
async function insert(name, row) { await bq.dataset(datasetId).table(name).insert([row]); return row; }
function razorpayConfigured() { return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }
function paymentLinkHeaders() {
  return {
    authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    'content-type': 'application/json'
  };
}
async function createRazorpayPaymentLink(order) {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured');
  const amount = Math.round(Number(order.total_amount) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) throw new Error('total_amount must be at least INR 1.00');
  const payload = {
    amount,
    currency: 'INR',
    reference_id: order.order_id,
    description: `Order ${order.order_id}`,
    customer: { name: order.customer_name },
    notify: { sms: Boolean(order.phone_number), email: Boolean(order.email) },
    reminder_enable: true,
    notes: { order_id: order.order_id, customer_id: order.customer_id }
  };
  if (order.phone_number) payload.customer.contact = String(order.phone_number);
  if (order.email) payload.customer.email = order.email;
  if (process.env.RAZORPAY_CALLBACK_URL) {
    payload.callback_url = process.env.RAZORPAY_CALLBACK_URL;
    payload.callback_method = 'get';
  }
  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST', headers: paymentLinkHeaders(), body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || 'Razorpay could not create the payment link');
  return data;
}
function webhookIsValid(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
function paymentLinkCallbackIsValid(query) {
  const values = [query.razorpay_payment_link_id, query.razorpay_payment_link_reference_id, query.razorpay_payment_link_status, query.razorpay_payment_id];
  if (!process.env.RAZORPAY_KEY_SECRET || !query.razorpay_signature || values.some(value => !value)) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(values.join('|')).digest('hex');
  return expected.length === query.razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(query.razorpay_signature));
}
async function finalizePaidOrder(paymentLinkId, paymentId) {
  // The transaction makes repeated Razorpay webhook deliveries harmless: only the first can reserve stock.
  const query = `
    BEGIN TRANSACTION;
    DECLARE target STRUCT<order_id STRING, quantity NUMERIC, inventory_stock_id STRING, payment_status STRING> DEFAULT (
      SELECT AS STRUCT order_id, quantity, inventory_stock_id, payment_status
      FROM ${table('orders')} WHERE razorpay_payment_link_id=@paymentLinkId LIMIT 1
    );
    ASSERT target.order_id IS NOT NULL AS 'Order for Razorpay payment link was not found';
    IF target.payment_status != 'PAID' THEN
      IF target.inventory_stock_id IS NOT NULL THEN
        UPDATE ${table('inventory_stock')}
        SET quantity = quantity - target.quantity,
            status = IF(quantity - target.quantity <= 0, 'OUT_OF_STOCK', status),
            updated_at = CURRENT_TIMESTAMP()
        WHERE stock_id = target.inventory_stock_id AND quantity >= target.quantity;
        ASSERT @@row_count = 1 AS 'Inventory is unavailable for this order';
      END IF;
      UPDATE ${table('orders')}
      SET payment_status='PAID', order_status='PROCESSING', razorpay_payment_id=@paymentId,
          razorpay_payment_link_status='paid', payment_received_at=CURRENT_TIMESTAMP(),
          inventory_committed_at=CURRENT_TIMESTAMP(), updated_at=CURRENT_TIMESTAMP()
      WHERE order_id = target.order_id;
    END IF;
    COMMIT TRANSACTION;`;
  await rows(query, { paymentLinkId, paymentId });
  const [order] = await rows(`SELECT * FROM ${table('orders')} WHERE razorpay_payment_link_id=@paymentLinkId LIMIT 1`, { paymentLinkId });
  return order;
}
function qrId(customerId, orderId, postalCode) {
  // Five letters from customer/order, a microsecond sequence, then postcode-derived location code.
  const letters = crypto.createHash('sha256').update(`${customerId}:${orderId}`).digest('hex')
    .replace(/[0-9]/g, c => 'ABCDEFGHIJ'[Number(c)]).slice(0, 5).toUpperCase();
  const sequence = String(Date.now() * 1000 + Number(process.hrtime.bigint() % 1000n));
  const location = crypto.createHash('sha1').update(String(postalCode)).digest('hex')
    .replace(/[0-9]/g, c => 'ABCDEFGHIJ'[Number(c)]).slice(0, 2).toUpperCase();
  return `${letters}${sequence}${location}`;
}

app.post('/materials', async (req, res, next) => { try {
  const x = req.body; if (!x.material_name) return fail(res, 400, 'material_name is required');
  if (x.unit && !unitOk(x.unit)) return fail(res, 400, 'Invalid unit');
  res.status(201).json(await insert('materials', { ...x, material_id: id('MAT'), created_at: now(), updated_at: now() }));
} catch (e) { next(e); } });
app.patch('/materials/:id/price', async (req, res, next) => { try {
  if (req.body.price == null) return fail(res, 400, 'price is required');
  await rows(`UPDATE ${table('materials')} SET price=@price, updated_at=CURRENT_TIMESTAMP() WHERE material_id=@id`, { price: req.body.price, id: req.params.id }); res.sendStatus(204);
} catch (e) { next(e); } });
app.post('/inventory', async (req, res, next) => { try {
  const x = req.body; if (!x.category) return fail(res, 400, 'category is required');
  if (!statusOk(x.status || 'AVAILABLE', ['AVAILABLE','LOW_STOCK','OUT_OF_STOCK'])) return fail(res, 400, 'Invalid status');
  res.status(201).json(await insert('inventory_stock', { ...x, stock_id: id('STK'), status: x.status || 'AVAILABLE', created_at: now(), updated_at: now() }));
} catch (e) { next(e); } });
app.patch('/inventory/:id/quantity', async (req, res, next) => { try {
  if (req.body.quantity == null) return fail(res, 400, 'quantity is required');
  await rows(`UPDATE ${table('inventory_stock')} SET quantity=@quantity, updated_at=CURRENT_TIMESTAMP() WHERE stock_id=@id`, { quantity: req.body.quantity, id: req.params.id }); res.sendStatus(204);
} catch (e) { next(e); } });
app.post('/customers', async (req, res, next) => { try {
  const x = req.body; if (!x.customer_id || !x.customer_name) return fail(res, 400, 'customer_id and customer_name are required');
  const existing = await rows(`SELECT 1 FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: x.customer_id });
  if (existing.length) return fail(res, 409, 'customer_id already exists and is permanent');
  res.status(201).json(await insert('customers', { ...x, created_at: now(), updated_at: now() }));
} catch (e) { next(e); } });
app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));

app.post('/orders', async (req, res, next) => { try {
  const x = req.body; if (!x.customer_id || !x.product_name || !x.postal_code) return fail(res, 400, 'customer_id, product_name and postal_code are required');
  const [customer] = await rows(`SELECT customer_name FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: x.customer_id });
  if (!customer) return fail(res, 404, 'Customer not found');
  if (!statusOk(x.order_status || 'PENDING', ['PENDING','PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED'])) return fail(res, 400, 'Invalid order_status');
  if (!statusOk(x.payment_status || 'PENDING', ['PENDING','PAID','FAILED'])) return fail(res, 400, 'Invalid payment_status');
  const order_id = id('ORD'); const qr_id = qrId(x.customer_id, order_id, x.postal_code);
  const duplicate = await rows(`SELECT 1 FROM ${table('orders')} WHERE qr_id=@qr LIMIT 1`, { qr: qr_id }); if (duplicate.length) return fail(res, 409, 'QR collision; retry request');
  const qr_image_gcs_uri = `gs://${bucketName}/qr-codes/${order_id}.png`;
  const png = await QRCode.toBuffer(qr_id, { type: 'png', errorCorrectionLevel: 'M' });
  await storage.bucket(bucketName).file(`qr-codes/${order_id}.png`).save(png, { contentType: 'image/png' });
  const row = { ...x, order_id, qr_id, qr_image_gcs_uri, customer_name: customer.customer_name, order_date: x.order_date || now(), order_status: x.order_status || 'PENDING', payment_status: x.payment_status || 'PENDING', total_amount: x.total_amount ?? Number(x.quantity || 0) * Number(x.price_per_unit || 0), created_at: now(), updated_at: now() };
  res.status(201).json(await insert('orders', row));
} catch (e) { next(e); } });
app.post('/checkout/orders', async (req, res, next) => { try {
  if (!razorpayConfigured()) return fail(res, 503, 'Payments are not configured');
  const x = req.body;
  if (!x.customer_id || !x.product_name || !x.postal_code || x.total_amount == null) return fail(res, 400, 'customer_id, product_name, postal_code and total_amount are required');
  if (x.inventory_stock_id && (!Number.isFinite(Number(x.quantity)) || Number(x.quantity) <= 0)) return fail(res, 400, 'A positive quantity is required when inventory_stock_id is supplied');
  const [customer] = await rows(`SELECT customer_name, phone_number, email FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: x.customer_id });
  if (!customer) return fail(res, 404, 'Customer not found');
  const order_id = id('ORD');
  const qr_id = qrId(x.customer_id, order_id, x.postal_code);
  const order = {
    ...x, order_id, qr_id, customer_name: customer.customer_name,
    order_date: now(), order_status: 'PENDING', payment_status: 'PENDING', total_amount: Number(x.total_amount),
    qr_image_gcs_uri: `gs://${bucketName}/qr-codes/${order_id}.png`, created_at: now(), updated_at: now()
  };
  const link = await createRazorpayPaymentLink({ ...order, phone_number: customer.phone_number, email: customer.email });
  const png = await QRCode.toBuffer(qr_id, { type: 'png', errorCorrectionLevel: 'M' });
  await storage.bucket(bucketName).file(`qr-codes/${order_id}.png`).save(png, { contentType: 'image/png' });
  const saved = await insert('orders', {
    ...order, razorpay_payment_link_id: link.id, razorpay_payment_link_status: link.status, payment_link_url: link.short_url
  });
  res.status(201).json({ order_id: saved.order_id, payment_status: saved.payment_status, payment_link_url: link.short_url, message: 'Order received. Complete payment to confirm it.' });
} catch (e) { next(e); } });
app.post('/webhooks/razorpay', async (req, res, next) => { try {
  if (!webhookIsValid(req.rawBody, req.get('x-razorpay-signature'))) return fail(res, 400, 'Invalid Razorpay webhook signature');
  const event = req.body;
  if (event.event !== 'payment_link.paid') return res.status(200).json({ received: true });
  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  if (!link?.id || !payment?.id || link.status !== 'paid') return fail(res, 400, 'Invalid payment_link.paid payload');
  const order = await finalizePaidOrder(link.id, payment.id);
  res.status(200).json({ received: true, order_id: order.order_id, message: 'Payment received. Your order is confirmed.' });
} catch (e) { next(e); } });
app.get('/orders/:id/payment-status', async (req, res, next) => { try {
  const [order] = await rows(`SELECT order_id, payment_status, order_status, payment_link_url FROM ${table('orders')} WHERE order_id=@id LIMIT 1`, { id: req.params.id });
  if (!order) return fail(res, 404, 'Order not found');
  res.json({ ...order, message: order.payment_status === 'PAID' ? 'Payment received. Your order is confirmed.' : 'Payment is still pending.' });
} catch (e) { next(e); } });
app.get('/payments/razorpay/callback', async (req, res, next) => { try {
  const paymentLinkId = req.query.razorpay_payment_link_id;
  if (!paymentLinkId) return fail(res, 400, 'razorpay_payment_link_id is required');
  if (!paymentLinkCallbackIsValid(req.query)) return fail(res, 400, 'Invalid Razorpay payment callback signature');
  let order;
  if (req.query.razorpay_payment_link_status === 'paid') order = await finalizePaidOrder(paymentLinkId, req.query.razorpay_payment_id);
  else [order] = await rows(`SELECT order_id, payment_status, order_status FROM ${table('orders')} WHERE razorpay_payment_link_id=@paymentLinkId LIMIT 1`, { paymentLinkId });
  if (!order) return fail(res, 404, 'Order not found');
  res.json({ ...order, message: order.payment_status === 'PAID' ? 'Payment received. Your order is confirmed.' : 'Payment is not complete yet.' });
} catch (e) { next(e); } });
app.patch('/orders/:id/status', async (req, res, next) => { try {
  if (!statusOk(req.body.order_status, ['PENDING','PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED'])) return fail(res, 400, 'Invalid order_status');
  await rows(`UPDATE ${table('orders')} SET order_status=@status, updated_at=CURRENT_TIMESTAMP() WHERE order_id=@id`, { status: req.body.order_status, id: req.params.id }); res.sendStatus(204);
} catch (e) { next(e); } });
app.post('/exports/:tableName', async (req, res, next) => { try {
  const allowed = ['materials','inventory_stock','customers','orders']; if (!allowed.includes(req.params.tableName)) return fail(res, 400, 'Invalid export table');
  const suffix = Date.now(); const staging = bq.dataset(datasetId).table(`export_${req.params.tableName}_${suffix}`);
  const destinationUri = `gs://${bucketName}/backups/${req.params.tableName}/${suffix}-*.csv`;
  const [job] = await bq.createQueryJob({ query: `CREATE TABLE ${table(`export_${req.params.tableName}_${suffix}`)} AS SELECT * FROM ${table(req.params.tableName)}`, location: 'asia-south1' });
  await job.getQueryResults();
  await staging.extract(destinationUri, { format: 'csv', printHeader: true });
  res.status(201).json({ destinationUri });
} catch (e) { next(e); } });
app.use((err, req, res, next) => { console.error(err); fail(res, err.code === 403 ? 403 : 500, err.message || 'Internal error'); });
app.listen(process.env.PORT || 8080, () => console.log('Inventory API listening'));
