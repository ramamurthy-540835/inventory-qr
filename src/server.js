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
app.use(express.json());

const table = name => `\`${projectId}.${datasetId}.${name}\``;
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const fail = (res, status, message) => res.status(status).json({ error: message });
const unitOk = value => ['KG', 'GRAM', 'LITRE', 'PIECE'].includes(value);
const statusOk = (value, choices) => choices.includes(value);
async function rows(query, params = {}) { return (await bq.query({ query, params, location: 'asia-south1' }))[0]; }
async function insert(name, row) { await bq.dataset(datasetId).table(name).insert([row]); return row; }
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
