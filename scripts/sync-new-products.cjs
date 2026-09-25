'use strict';
const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { BigQuery } = require('@google-cloud/bigquery');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'aidirac-503309';
const dataset = process.env.BQ_DATASET || 'inventory_management';
const firebaseApp = getApps()[0] || initializeApp({ projectId });
const firestore = getFirestore(firebaseApp);
const bq = new BigQuery({ projectId });
const products = [
  ['Atta','1 kg',49.10,'flour-rava'],['Black Channa','1 kg',111.50,'dals-pulses'],['Black Channa','500 g',57.25,'dals-pulses'],
  ['Cashew Nut','500 g',633,'nuts-dry-fruits'],['Cashew Nut','100 g',126.80,'nuts-dry-fruits'],['Elaichi','50 g',312.70,'spices-masalas'],['Elaichi','5 g',33.07,'spices-masalas'],
  ['Gingelly Oil','1 litre',420,'oils-ghee'],['Gram Dal','1 kg',125.80,'dals-pulses'],['Gram Dal','500 g',64.50,'dals-pulses'],
  ['Groundnut','1 kg',222,'nuts-dry-fruits'],['Groundnut','500 g',112.50,'nuts-dry-fruits'],['Groundnut Oil','1 litre',310,'oils-ghee'],
  ['Jeera','200 g',89.40,'spices-masalas'],['Jeera','100 g',43.20,'spices-masalas'],['Jeera','50 g',24.10,'spices-masalas'],
  ['Moong Dal','1 kg',144,'dals-pulses'],['Moong Dal','500 g',73.50,'dals-pulses'],['Pepper','200 g',209,'spices-masalas'],['Pepper','100 g',105,'spices-masalas'],['Pepper','50 g',54,'spices-masalas'],
  ['Raw Rice','5 kg',256.80,'rice-grains'],['Raw Rice','1 kg',51.96,'rice-grains'],['Rice','5 kg',496.95,'rice-grains'],['Rice','1 kg',101.22,'rice-grains'],
  ['Sambar Powder','100 g',47.60,'spices-masalas'],['Sambar Powder','50 g',25.40,'spices-masalas'],['Sooji','1 kg',53,'flour-rava'],['Sooji','500 g',28,'flour-rava'],
  ['Soombu','100 g',53,'spices-masalas'],['Soombu','50 g',28,'spices-masalas'],['Sugar','1 kg',89.40,'sugar-salt'],['Sugar','500 g',45.20,'sugar-salt'],['Sugar','200 g',19.68,'sugar-salt'],
  ['Tamarind','1 kg',391,'cooking-essentials'],['Tamarind','500 g',197,'cooking-essentials'],['Test Product','1 piece',1,'cooking-essentials'],['Toor Dal','1 kg',170,'dals-pulses'],['Toor Dal','500 g',86.50,'dals-pulses'],
];
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const images = {
  Atta:'/product-images/atta-1kg.webp','Black Channa':'/product-images/black-channa-500g.webp','Cashew Nut':'/product-images/cashew-nut-50g.webp',
  Elaichi:'/product-images/elaichi-5g.webp','Gingelly Oil':'/product-images/gingelly-oil-1l.webp','Gram Dal':'/product-images/gram-dal-500g.webp',
  Groundnut:'/product-images/groundnut-100g.webp','Groundnut Oil':'/product-images/groundnut-oil-1l.png','Jeera':'/product-images/jeera-100g.webp',
  'Moong Dal':'/product-images/moong-dal-500g.webp',Pepper:'/product-images/pepper-100g.webp','Raw Rice':'/product-images/raw-rice-1kg-v4.png',
  Rice:'/product-images/rice-5kg.webp','Sambar Powder':'/product-images/sambar-powder-100g.webp',Sooji:'/product-images/sooji-500g.png',
  Soombu:'/product-images/soombu-100g.webp',Sugar:'/product-images/sugar-500g.webp',Tamarind:'/product-images/tamarind-500g.webp',
  'Toor Dal':'/product-images/toor-dal-1kg.webp',
};
async function main() {
  const snapshot = await firestore.collection('products').get();
  const existing = new Map(snapshot.docs.map(doc => [`${doc.data().name}|${doc.data().unit}`, doc]));
  const desired = new Set(products.map(([name, unit]) => `${name}|${unit}`));
  const batch = firestore.batch(); const rows = []; const timestamp = new Date().toISOString();
  const retired = [];
  for (const doc of snapshot.docs) if (doc.data().active !== false && !desired.has(`${doc.data().name}|${doc.data().unit}`)) {
    batch.update(doc.ref, { active:false, updatedAt:FieldValue.serverTimestamp() });
    retired.push(doc.id);
  }
  for (const [name, unit, price, categoryId] of products) {
    const old = existing.get(`${name}|${unit}`); const productId = old?.id || `${slug(name)}-${slug(unit)}`;
    const imageUrl = images[name] || old?.data().imageUrl || '/product-images/nelture-grocery-fallback.png';
    batch.set(firestore.collection('products').doc(productId), { name, brand:'', unit, price, mrp:price, stock:100, categoryId, imageUrl, active:true, updatedAt:FieldValue.serverTimestamp(), ...(old ? {} : { createdAt:FieldValue.serverTimestamp() }) }, { merge:true });
    rows.push({ product_id:productId, name, brand:'', unit, price, mrp:price, stock:100, category_id:categoryId, image_url:imageUrl, active:true, created_at:timestamp, updated_at:timestamp });
  }
  await batch.commit();
  const table = `\`${projectId}.${dataset}.products\``;
  for (const product_id of retired) await bq.query({ location:'asia-south1', params:{ product_id }, query:`UPDATE ${table} SET active=false, updated_at=CURRENT_TIMESTAMP() WHERE product_id=@product_id` });
  for (const row of rows) await bq.query({ location:'asia-south1', params:row, query:`MERGE ${table} T USING (SELECT @product_id product_id, @name name, @brand brand, @unit unit, CAST(@price AS NUMERIC) price, CAST(@mrp AS NUMERIC) mrp, CAST(@stock AS INT64) stock, @category_id category_id, @image_url image_url, @active active, CAST(@created_at AS TIMESTAMP) created_at, CAST(@updated_at AS TIMESTAMP) updated_at) S ON T.product_id=S.product_id WHEN MATCHED THEN UPDATE SET name=S.name, brand=S.brand, unit=S.unit, price=S.price, mrp=S.mrp, stock=S.stock, category_id=S.category_id, image_url=S.image_url, active=S.active, updated_at=S.updated_at WHEN NOT MATCHED THEN INSERT (product_id,name,brand,unit,price,mrp,stock,category_id,image_url,active,created_at,updated_at) VALUES (S.product_id,S.name,S.brand,S.unit,S.price,S.mrp,S.stock,S.category_id,S.image_url,S.active,S.created_at,S.updated_at)` });
  console.log(`synced=${rows.length}`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
