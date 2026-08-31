import express from 'express';
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'aidirac-503309';
const bucketName = process.env.GCS_BUCKET || 'aidirac-503309-grocery-public-images';
const datasetId = process.env.BIGQUERY_DATASET || 'grocery_analytics';
const tableId = process.env.BIGQUERY_TABLE || 'product_images';
const storage = new Storage({ projectId });
const bigquery = new BigQuery({ projectId });
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);

if (!admin.apps.length) admin.initializeApp();
const slug = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const fileId = () => `IMG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 12)}`;
const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'], ['image/avif', 'avif']]);
const publicUrl = objectName => `https://storage.googleapis.com/${bucketName}/${objectName.split('/').map(encodeURIComponent).join('/')}`;
const error = (res, status, message) => res.status(status).json({ error: message });

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) res.set('access-control-allow-origin', origin);
  res.set('vary', 'Origin');
  res.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.set('access-control-allow-headers', 'Authorization,Content-Type,X-File-Name,X-Location,X-Description');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

async function requireFirebaseUser(req, res, next) {
  try {
    const token = String(req.get('authorization') || '');
    if (!token.startsWith('Bearer ')) return error(res, 401, 'Firebase ID token is required');
    req.user = await admin.auth().verifyIdToken(token.slice(7));
    next();
  } catch { return error(res, 401, 'Invalid or expired Firebase ID token'); }
}

app.get('/health', (_, res) => res.json({ ok: true, service: 'Product Image Agent' }));
app.get('/agent-prompt', (_, res) => res.type('text/markdown').sendFile('AGENT_PROMPT.md', { root: process.cwd() }));
app.get('/api/products', async (req, res, next) => { try {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const location = slug(req.query.location);
  const where = location ? 'WHERE location=@location' : '';
  const [rows] = await bigquery.query({ query: `SELECT file_id AS fileId, stored_filename AS storedFilename, location, description, content_type AS contentType, size_bytes AS sizeBytes, public_url AS publicUrl, created_at AS createdAt FROM \`${projectId}.${datasetId}.${tableId}\` ${where} ORDER BY created_at DESC LIMIT @limit`, params: location ? { location, limit } : { limit }, location: 'asia-south1' });
  res.json({ products: rows });
} catch (e) { next(e); } });
app.get('/', (_, res) => res.type('html').send(`<!doctype html><title>Product Image Agent</title><style>body{font-family:system-ui;margin:2rem;max-width:1100px}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}img{width:100%;height:180px;object-fit:cover;border-radius:8px}article{border:1px solid #ddd;padding:.75rem;border-radius:10px}</style><h1>Product Images</h1><p>Public product display. Uploads require Firebase authentication.</p><div id="grid"></div><script>fetch('/api/products').then(r=>r.json()).then(({products})=>document.querySelector('#grid').innerHTML=products.map(p=>'<article><img src="'+p.publicUrl+'" alt="'+p.description.replaceAll('&','&amp;').replaceAll('<','&lt;')+'"><b>'+p.description+'</b><br><small>'+p.location+' · '+p.fileId+'</small></article>').join('')).catch(()=>document.querySelector('#grid').textContent='Unable to load products.')</script>`));
app.post('/api/uploads', requireFirebaseUser, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], limit: '10mb' }), async (req, res, next) => { try {
  const contentType = String(req.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = allowed.get(contentType);
  const location = slug(req.get('x-location'));
  const description = String(req.get('x-description') || '').trim().slice(0, 240);
  const originalFilename = String(req.get('x-file-name') || 'upload').replace(/[\\/]/g, '_').slice(0, 180);
  if (!extension) return error(res, 415, 'Only JPEG, PNG, WebP, GIF, and AVIF images are supported');
  if (!location || !description) return error(res, 400, 'x-location and x-description are required');
  if (!Buffer.isBuffer(req.body) || !req.body.length) return error(res, 400, 'Image body is required');
  const id = fileId(); const descriptionSlug = slug(description) || 'product';
  const storedFilename = `${location}-${descriptionSlug}-${id}.${extension}`;
  const objectName = `public-images/${location}/${storedFilename}`;
  await storage.bucket(bucketName).file(objectName).save(req.body, { resumable: false, contentType, metadata: { cacheControl: 'public,max-age=31536000,immutable', metadata: { fileId: id, location, description, uploadedBy: req.user.uid } } });
  const url = publicUrl(objectName);
  const record = { file_id: id, original_filename: originalFilename, stored_filename: storedFilename, location, description, content_type: contentType, size_bytes: req.body.length, gcs_uri: `gs://${bucketName}/${objectName}`, public_url: url, uploaded_by: req.user.uid, created_at: new Date().toISOString() };
  try { await bigquery.dataset(datasetId).table(tableId).insert([record]); }
  catch (databaseError) { await storage.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true }); throw databaseError; }
  res.status(201).json({ fileId: id, storedFilename, location, description, publicUrl: url, productUrl: `${req.protocol}://${req.get('host')}/api/products` });
} catch (e) { next(e); } });
app.use((err, _, res, __) => { console.error(err); error(res, err.code === 403 ? 403 : 500, err.message || 'Request failed'); });
app.listen(process.env.PORT || 8080, () => console.log('Product Image Agent ready'));
