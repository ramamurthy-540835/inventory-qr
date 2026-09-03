import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import QRCode from 'qrcode';
import sharp from 'sharp';
import crypto from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'customer-grocery-507211';
const datasetId = 'inventory_management';
const bucketName = process.env.GCS_BUCKET || `${projectId}-inventory-management`;
const bq = new BigQuery({ projectId });
const storage = new Storage({ projectId });
const firebaseApp = getApps()[0] || initializeApp({ projectId });
const firestore = getFirestore(firebaseApp);
const googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(dirname, '..', 'public')));
app.get('/generated-product-images/:id.png', async (req, res, next) => { try {
  const imageId = String(req.params.id || ''); if (!/^[a-z0-9-]{1,80}$/i.test(imageId)) return fail(res, 400, 'Invalid image ID');
  const [bytes] = await storage.bucket(bucketName).file(`product-images/generated/${imageId}.png`).download();
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(bytes);
} catch (e) { if (e.code === 404) return fail(res, 404, 'Generated product image not found'); next(e); } });

app.get('/', (req, res) => res.json({ service: 'inventory-management-api', status: 'ok', health: '/health' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/register', (req, res) => res.sendFile(path.join(dirname, '..', 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(dirname, '..', 'public', 'login.html')));
app.get('/admin', async (req, res, next) => { try { if (!await requireAdmin(req)) return res.redirect('/admin/login'); res.sendFile(path.join(dirname, '..', 'public', 'admin.html')); } catch (e) { next(e); } });
app.get('/admin/login', (req, res) => res.sendFile(path.join(dirname, '..', 'public', 'admin-login.html')));
app.get(['/app', '/app/*'], (req, res) => res.sendFile(path.join(dirname, '..', 'public', 'app', 'index.html')));
app.get('/api/catalog', async (req, res, next) => { try {
  const [categorySnapshot, productSnapshot] = await Promise.all([
    firestore.collection('categories').where('active', '==', true).limit(100).get(),
    firestore.collection('products').where('active', '==', true).limit(100).get(),
  ]);
  res.json({
    categories: categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    products: productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  });
} catch (e) { next(e); } });
app.get('/payments/config', (req, res) => res.json({ keyId: process.env.RAZORPAY_KEY_ID || '' }));
app.post('/payments/order', async (req, res, next) => { try {
  const customer = await currentSessionCustomer(req); if (!customer) return fail(res, 401, 'Please sign in before payment');
  const items = Array.isArray(req.body.items) ? req.body.items : []; if (!items.length) return fail(res, 400, 'Cart is empty');
  let amount = 0; for (const item of items) { const snap = await firestore.collection('products').doc(String(item.productId)).get(); const product = snap.data(); if (!product?.active || Number(product.stock) < Number(item.quantity)) return fail(res, 409, 'A cart product is unavailable'); amount += Math.round(Number(product.price) * Number(item.quantity) * 100); }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64'); const receipt = `nel_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const razorpay = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, currency: 'INR', receipt }) }); const order = await razorpay.json(); if (!razorpay.ok) return fail(res, 502, order.error?.description || 'Unable to create Razorpay order');
  res.status(201).json({ id: order.id, amount: order.amount, currency: order.currency, customer: { name: customer.customer_name, email: customer.email, contact: customer.phone_number } });
} catch (e) { next(e); } });
app.post('/payments/verify', async (req, res, next) => { try { const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${req.body.razorpay_order_id}|${req.body.razorpay_payment_id}`).digest('hex'); if (expected !== req.body.razorpay_signature) return fail(res, 400, 'Payment signature verification failed'); res.json({ verified: true }); } catch (e) { next(e); } });

const table = name => `\`${projectId}.${datasetId}.${name}\``;
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const customerId = name => {
  const letters = String(name).replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  return `${letters}${crypto.randomInt(100, 1000)}`;
};
function inferProductDetails(name) {
  const value = String(name).toLowerCase();
  const matches = [
    { words: /rice|basmati|ponni|kolam|sona masoori|raw rice/, categoryId: 'rice-grains', imageUrl: '/product-images/rice-5kg.webp' },
    { words: /atta|flour|maida|rava|sooji|semolina/, categoryId: 'atta-flour', imageUrl: '/product-images/atta-1kg.webp' },
    { words: /dal|pulse|channa|chana|gram|lentil|rajma|moong/, categoryId: 'dals-pulses', imageUrl: '/product-images/toor-dal-1kg.webp' },
    { words: /oil|ghee|gingelly|sesame|sunflower|coconut oil/, categoryId: 'oil-ghee', imageUrl: '/product-images/gingelly-oil-1l.webp' },
    { words: /masala|powder|jeera|cumin|pepper|elaichi|cardamom|fennel|spice/, categoryId: 'spices', imageUrl: '/product-images/sambar-powder-100g.webp' },
    { words: /cashew|groundnut|peanut|chips|snack|biscuit/, categoryId: 'snacks', imageUrl: '/product-images/cashew-nut-50g.webp' },
    { words: /sugar|salt|tamarind|jaggery/, categoryId: 'essentials', imageUrl: '/product-images/sugar-500g.webp' },
    { words: /milk|curd|butter|cheese|paneer/, categoryId: 'dairy-milk', imageUrl: '/product-images/nelture-grocery-fallback.png' },
    { words: /bread|bakery|bun|cake/, categoryId: 'bread-bakery', imageUrl: '/product-images/nelture-grocery-fallback.png' },
    { words: /tea|coffee|juice|drink|beverage/, categoryId: 'beverages', imageUrl: '/product-images/nelture-grocery-fallback.png' },
  ];
  const match = matches.find(candidate => candidate.words.test(value));
  return match ? { categoryId: match.categoryId, imageUrl: match.imageUrl } : { categoryId: 'essentials', imageUrl: '/product-images/nelture-grocery-fallback.png' };
}
function productImageSubject(name, categoryId) {
  const value = String(name).toLowerCase();
  if (/raw rice|rice|basmati|ponni|kolam|sona masoori/.test(value)) return 'a traditional wooden bowl or open jute sack clearly filled with loose uncooked rice grains';
  if (/atta|flour|maida/.test(value)) return 'a bowl and small open jute sack clearly filled with fine wheat flour';
  if (/rava|sooji|semolina/.test(value)) return 'a small wooden bowl clearly filled with golden semolina grains';
  if (/black channa|black chana/.test(value)) return 'a rustic bowl clearly filled with black chickpeas';
  if (/toor dal/.test(value)) return 'a rustic bowl clearly filled with yellow split toor dal';
  if (/moong dal/.test(value)) return 'a rustic bowl clearly filled with yellow moong dal';
  if (/gram dal/.test(value)) return 'a rustic bowl clearly filled with split gram dal';
  if (/oil|ghee/.test(value)) return `a simple unbranded bottle clearly containing ${name}`;
  if (/elaichi|cardamom/.test(value)) return 'a small rustic bowl clearly filled with green cardamom pods';
  if (/jeera|cumin/.test(value)) return 'a small rustic bowl clearly filled with cumin seeds';
  if (/pepper/.test(value)) return 'a small rustic bowl clearly filled with whole black peppercorns';
  if (/sugar/.test(value)) return 'a small rustic bowl clearly filled with white sugar crystals';
  if (/tamarind/.test(value)) return 'a small rustic bowl clearly showing natural tamarind pods and pulp';
  if (/cashew/.test(value)) return 'a small rustic bowl clearly filled with whole cashew nuts';
  if (/groundnut|peanut/.test(value)) return 'a small rustic bowl clearly filled with shelled peanuts';
  return `a clearly identifiable, realistic ${name} grocery product, appropriate for ${categoryId}`;
}
const catalogueReferenceFiles = ['atta-1kg.webp','black-channa-500g.webp','cashew-nut-50g.webp','elaichi-5g.webp','gingelly-oil-1l.webp','gram-dal-500g.webp','groundnut-100g.webp','jeera-100g.webp','moong-dal-500g.webp','pepper-100g.webp','raw-rice-1kg.webp','rice-5kg.webp','samba-rava-500g.webp','sambar-powder-100g.webp','soombu-100g.webp','sugar-500g.webp','tamarind-500g.webp','toor-dal-1kg.webp'];
let catalogueStyleReferencePromise;
function catalogueStyleReference() {
  if (!catalogueStyleReferencePromise) catalogueStyleReferencePromise = Promise.all(catalogueReferenceFiles.map(async (file, index) => ({ input: await sharp(await readFile(path.join(dirname, '..', 'public', 'product-images', file))).resize(150, 150, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: (index % 6) * 150, top: Math.floor(index / 6) * 150 }))).then(tiles => sharp({ create: { width: 900, height: 450, channels: 4, background: '#ffffff' } }).composite(tiles).png().toBuffer());
  return catalogueStyleReferencePromise;
}
async function generateProductImage(productId, name, unit, categoryId) {
  const imageName = String(name).replace(/[\r\n]/g, ' ').trim().slice(0, 90);
  const token = await googleAuth.getAccessToken();
  const location = process.env.VERTEX_IMAGE_LOCATION || 'global';
  const model = process.env.VERTEX_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const endpoint = location === 'global' ? 'https://aiplatform.googleapis.com' : `https://${location}-aiplatform.googleapis.com`;
  const reference = await catalogueStyleReference();
  const subject = productImageSubject(imageName, categoryId);
  const prompt = `The supplied image is a contact sheet containing all current Nelture catalogue product images. Use every tile only as the cumulative visual format reference: same square crop, thin white outer frame, warm light-cream background, centered product, natural realistic texture, and soft shadow. The product name is mandatory and controls the subject: "${imageName}" (${unit}). Create exactly this subject: ${subject}. Do not create a generic grocery bag or a different ingredient. Generate exactly one product, photographed straight-on in the same catalogue format. Do not copy an existing product from the contact sheet. No people, hands, logos, brand names, readable text, watermark, collage, or multiple products.`;
  const response = await fetch(`${endpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: { role: 'USER', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: reference.toString('base64') } }] }, generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1', personGeneration: 'ALLOW_NONE', imageOutputOptions: { mimeType: 'image/png' } } } })
  });
  const body = await response.json(); const encoded = body.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData?.data;
  if (!response.ok || !encoded) throw Object.assign(new Error(body.error?.message || 'Vertex Imagen did not return an image'), { status: 502 });
  const framed = await sharp(Buffer.from(encoded, 'base64')).resize(560, 560, { fit: 'contain', background: '#f8f5ed' }).flatten({ background: '#f8f5ed' }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' }).png().toBuffer();
  await storage.bucket(bucketName).file(`product-images/generated/${productId}.png`).save(framed, { resumable: false, contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000, immutable' } });
  return `/generated-product-images/${productId}.png`;
}
const fail = (res, status, message) => res.status(status).json({ error: message });
const unitOk = value => ['KG', 'GRAM', 'LITRE', 'PIECE'].includes(value);
const statusOk = (value, choices) => choices.includes(value);
async function rows(query, params = {}) { return (await bq.query({ query, params, location: 'asia-south1' }))[0]; }
async function insert(name, row) { await bq.dataset(datasetId).table(name).insert([row]); return row; }
function readCookie(req, name) { return (req.headers.cookie || '').split(';').map(item => item.trim().split('=')).find(([key]) => key === name)?.[1]; }
async function startSession(res, customer) {
  const token = crypto.randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await firestore.collection('sessions').doc(token).set({ customerId: customer.customer_id, expiresAt, createdAt: FieldValue.serverTimestamp() });
  res.cookie('nelture_session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14, path: '/' });
}
async function currentSessionCustomer(req) {
  const token = readCookie(req, 'nelture_session'); if (!token) return null;
  const session = await firestore.collection('sessions').doc(token).get(); const data = session.data();
  if (!data || data.expiresAt.toDate() < new Date()) return null;
  const [customer] = await rows(`SELECT customer_id, customer_name, phone_number, email, address, postal_code, city, state FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: data.customerId });
  return customer || null;
}
async function requireAdmin(req) { const token = readCookie(req, 'nelture_admin'); if (!token) return false; const session = await firestore.collection('admin_sessions').doc(token).get(); return Boolean(session.exists && session.data().expiresAt.toDate() > new Date()); }
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
  const x = req.body; if (!x.customer_name) return fail(res, 400, 'customer_name is required');
  const generatedId = String(x.customer_id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,15}$/.test(generatedId)) return fail(res, 400, 'customer_id is required and must use up to 15 letters, numbers, hyphens, or underscores');
  const existing = await rows(`SELECT 1 FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: generatedId });
  if (existing.length) return fail(res, 409, 'customer_id already exists; choose a different ID');
  const timestamp = now();
  const customer = await insert('customers', { ...x, customer_id: generatedId, created_at: timestamp, updated_at: timestamp }); await startSession(res, customer); res.status(201).json(customer);
} catch (e) { next(e); } });
app.post('/customers/login', async (req, res, next) => { try {
  const login = String(req.body.login || req.body.phone_number || '').trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
  const digits = login.replace(/\D/g, '').slice(-10);
  if (!isEmail && digits.length !== 10) return fail(res, 400, 'Enter a registered 10-digit mobile number or email address');
  const matches = isEmail
    ? await rows(`SELECT customer_id, customer_name, phone_number, email, address, postal_code, city, state FROM ${table('customers')} WHERE LOWER(email)=LOWER(@login) LIMIT 2`, { login })
    : await rows(`SELECT customer_id, customer_name, phone_number, email, address, postal_code, city, state FROM ${table('customers')} WHERE phone_number=@phone_number LIMIT 2`, { phone_number: `+91${digits}` });
  if (!matches.length) return fail(res, 401, `No Nelture account is registered with this ${isEmail ? 'email address' : 'mobile number'}`);
  if (matches.length > 1) return fail(res, 409, `More than one account uses this ${isEmail ? 'email address' : 'mobile number'}. Please contact support.`);
  const [customer] = matches;
  await startSession(res, customer); res.json(customer);
} catch (e) { next(e); } });
app.get('/auth/me', async (req, res, next) => { try { const customer = await currentSessionCustomer(req); if (!customer) return fail(res, 401, 'Not signed in'); res.json(customer); } catch (e) { next(e); } });
app.post('/auth/location', async (req, res, next) => { try {
  const customer = await currentSessionCustomer(req); if (!customer) return fail(res, 401, 'Please sign in to save a delivery location');
  const { address, postal_code, city, state } = req.body;
  if (!String(address || '').trim() || !/^\d{6}$/.test(String(postal_code || '')) || !String(city || '').trim() || !String(state || '').trim()) return fail(res, 400, 'Enter address, city, state, and a valid 6-digit PIN code');
  await rows(`UPDATE ${table('customers')} SET address=@address, postal_code=@postal_code, city=@city, state=@state, updated_at=CURRENT_TIMESTAMP() WHERE customer_id=@customer_id`, { address: String(address).trim(), postal_code: String(postal_code), city: String(city).trim(), state: String(state).trim(), customer_id: customer.customer_id });
  res.json({ ...customer, address: String(address).trim(), postal_code: String(postal_code), city: String(city).trim(), state: String(state).trim() });
} catch (e) { next(e); } });
app.post('/auth/logout', async (req, res, next) => { try { const token = readCookie(req, 'nelture_session'); if (token) await firestore.collection('sessions').doc(token).delete(); res.clearCookie('nelture_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); res.sendStatus(204); } catch (e) { next(e); } });
app.post('/admin/auth/login', async (req, res, next) => { try { const supplied = Buffer.from(String(req.body.password || '')); const expected = Buffer.from(process.env.ADMIN_PASSWORD || ''); if (!expected.length || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return fail(res, 401, 'Incorrect admin password'); const token = crypto.randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8); await firestore.collection('admin_sessions').doc(token).set({ expiresAt, createdAt: FieldValue.serverTimestamp() }); res.cookie('nelture_admin', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8, path: '/' }); res.sendStatus(204); } catch (e) { next(e); } });
app.post('/admin/auth/logout', async (req, res, next) => { try { const token = readCookie(req, 'nelture_admin'); if (token) await firestore.collection('admin_sessions').doc(token).delete(); res.clearCookie('nelture_admin', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); res.sendStatus(204); } catch (e) { next(e); } });
app.get('/admin/api/dashboard', async (req, res, next) => { try { if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required'); const [customerRows, orderRows, products] = await Promise.all([rows(`SELECT COUNT(*) AS count FROM ${table('customers')}`), rows(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS sales FROM ${table('orders')}`), firestore.collection('products').get()]); const inventory = products.docs.map(doc => doc.data()); res.json({ customers: Number(customerRows[0].count), orders: Number(orderRows[0].count), sales: Number(orderRows[0].sales), products: inventory.length, lowStock: inventory.filter(product => Number(product.stock || 0) <= 10).length }); } catch (e) { next(e); } });
app.get('/admin/api/products', async (req, res, next) => { try { if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required'); const snapshot = await firestore.collection('products').orderBy('name').get(); res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { next(e); } });
app.post('/admin/api/products', async (req, res, next) => { try {
  if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required');
  const name = String(req.body.name || '').trim(); const unit = String(req.body.unit || '').trim(); const brand = String(req.body.brand || 'Nelture').trim();
  const price = Number(req.body.price); const mrp = Number(req.body.mrp ?? price); const stock = Number(req.body.stock);
  if (!name || !unit || !Number.isFinite(price) || price < 0 || !Number.isFinite(mrp) || mrp < price || !Number.isInteger(stock) || stock < 0) return fail(res, 400, 'Enter a name, unit, valid selling price, MRP equal to or above price, and whole-number stock');
  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 55) || 'product';
  let productId = baseId; let suffix = 2; while ((await firestore.collection('products').doc(productId).get()).exists) productId = `${baseId}-${suffix++}`;
  const inferred = inferProductDetails(name);
  const imageUrl = await generateProductImage(productId, name, unit, inferred.categoryId);
  const product = { name, brand: brand || 'Nelture', unit, price, mrp, stock, active: true, ...inferred, imageUrl, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  await firestore.collection('products').doc(productId).set(product);
  res.status(201).json({ id: productId, ...product, createdAt: now(), updatedAt: now() });
} catch (e) { next(e); } });
app.post('/admin/api/products/:id/generate-image', async (req, res, next) => { try {
  if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required');
  const ref = firestore.collection('products').doc(req.params.id); const snapshot = await ref.get(); if (!snapshot.exists) return fail(res, 404, 'Product not found');
  const product = snapshot.data(); const inferred = inferProductDetails(product.name); const imageUrl = await generateProductImage(req.params.id, product.name, product.unit, inferred.categoryId);
  await ref.update({ ...inferred, imageUrl, updatedAt: FieldValue.serverTimestamp() }); res.json({ id: req.params.id, imageUrl });
} catch (e) { next(e); } });
app.patch('/admin/api/products/:id', async (req, res, next) => { try {
  if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required');
  const ref = firestore.collection('products').doc(req.params.id); if (!(await ref.get()).exists) return fail(res, 404, 'Product not found');
  const editable = ['name','brand','unit','price','mrp','stock','active','imageUrl']; const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(changes).length) return fail(res, 400, 'No editable product fields supplied');
  if ('name' in changes) { changes.name = String(changes.name).trim(); if (!changes.name) return fail(res, 400, 'Product name is required'); Object.assign(changes, inferProductDetails(changes.name)); }
  if ('brand' in changes) changes.brand = String(changes.brand).trim() || 'Nelture'; if ('unit' in changes) { changes.unit = String(changes.unit).trim(); if (!changes.unit) return fail(res, 400, 'Unit is required'); }
  for (const field of ['price', 'mrp', 'stock']) if (field in changes) changes[field] = Number(changes[field]);
  if (('price' in changes && (!Number.isFinite(changes.price) || changes.price < 0)) || ('mrp' in changes && (!Number.isFinite(changes.mrp) || changes.mrp < 0)) || ('stock' in changes && (!Number.isInteger(changes.stock) || changes.stock < 0))) return fail(res, 400, 'Price and MRP must be valid, and stock must be a whole number');
  await ref.update({ ...changes, updatedAt: FieldValue.serverTimestamp() }); res.sendStatus(204);
} catch (e) { next(e); } });
app.delete('/admin/api/products/:id', async (req, res, next) => { try { if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required'); const ref = firestore.collection('products').doc(req.params.id); if (!(await ref.get()).exists) return fail(res, 404, 'Product not found'); await ref.delete(); res.sendStatus(204); } catch (e) { next(e); } });
app.get('/admin/api/orders', async (req, res, next) => { try { if (!await requireAdmin(req)) return fail(res, 403, 'Admin access required'); res.json(await rows(`SELECT order_id, customer_name, product_name, quantity, total_amount, order_status, payment_status, order_date FROM ${table('orders')} ORDER BY order_date DESC LIMIT 100`)); } catch (e) { next(e); } });
app.patch('/customers/:id', async (req, res, next) => { try {
  const editable = ['customer_name', 'phone_number', 'email', 'address', 'postal_code', 'city', 'state'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => editable.includes(key) && value != null));
  if (!Object.keys(changes).length) return fail(res, 400, 'Provide at least one editable customer field');
  const assignments = Object.keys(changes).map(key => `${key}=@${key}`).join(', ');
  await rows(`UPDATE ${table('customers')} SET ${assignments}, updated_at=CURRENT_TIMESTAMP() WHERE customer_id=@customer_id`, { ...changes, customer_id: req.params.id });
  res.sendStatus(204);
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
app.post('/checkout', async (req, res, next) => { try {
  const { customer_id, items } = req.body;
  if (!customer_id || !Array.isArray(items) || !items.length) return fail(res, 400, 'customer_id and one or more cart items are required');
  const signedInCustomer = await currentSessionCustomer(req); if (!signedInCustomer || signedInCustomer.customer_id !== customer_id) return fail(res, 401, 'Please sign in before checkout');
  const [customer] = await rows(`SELECT customer_name, postal_code, address FROM ${table('customers')} WHERE customer_id=@id LIMIT 1`, { id: customer_id });
  if (!customer?.postal_code || !customer?.address) return fail(res, 400, 'A saved delivery address and PIN code are required before checkout');
  const requested = items.map(item => ({ productId: String(item.productId || ''), quantity: Number(item.quantity) })).filter(item => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);
  if (requested.length !== items.length) return fail(res, 400, 'Cart contains an invalid item quantity');
  const products = new Map();
  await firestore.runTransaction(async transaction => {
    for (const item of requested) {
      const ref = firestore.collection('products').doc(item.productId); const snap = await transaction.get(ref); const product = snap.data();
      if (!snap.exists || !product?.active) throw Object.assign(new Error('A cart product is no longer available'), { status: 409 });
      if (Number(product.stock || 0) < item.quantity) throw Object.assign(new Error(`${product.name} does not have enough stock`), { status: 409 });
      products.set(item.productId, { ...product, id: snap.id });
      transaction.update(ref, { stock: Number(product.stock) - item.quantity, updatedAt: FieldValue.serverTimestamp() });
    }
  });
  const placed = [];
  try {
    for (const item of requested) {
      const product = products.get(item.productId); const order_id = id('ORD'); const qr_id = qrId(customer_id, order_id, customer.postal_code);
      const png = await QRCode.toBuffer(qr_id, { type: 'png', errorCorrectionLevel: 'M' }); const qr_image_gcs_uri = `gs://${bucketName}/qr-codes/${order_id}.png`;
      await storage.bucket(bucketName).file(`qr-codes/${order_id}.png`).save(png, { contentType: 'image/png' });
      const row = { order_id, qr_id, qr_image_gcs_uri, customer_id, customer_name: customer.customer_name, order_date: now(), product_name: product.name, quantity: item.quantity, unit: product.unit, price_per_unit: product.price, total_amount: Number(product.price) * item.quantity, postal_code: customer.postal_code, delivery_address: customer.address, order_status: 'PENDING', payment_status: req.body.payment_status === 'PAID' ? 'PAID' : 'PENDING', created_at: now(), updated_at: now() };
      placed.push(await insert('orders', row));
    }
  } catch (error) {
    await firestore.runTransaction(async transaction => { for (const item of requested) transaction.update(firestore.collection('products').doc(item.productId), { stock: FieldValue.increment(item.quantity), updatedAt: FieldValue.serverTimestamp() }); });
    throw error;
  }
  res.status(201).json({ message: 'Order placed successfully', orders: placed, total_amount: placed.reduce((sum, order) => sum + Number(order.total_amount), 0) });
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
app.use((err, req, res, next) => { console.error(err); fail(res, err.status || (err.code === 403 ? 403 : 500), err.message || 'Internal error'); });
app.listen(process.env.PORT || 8080, () => console.log('Inventory API listening'));
