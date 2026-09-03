import { db } from '../firebase/admin.js';
export async function nextCustomerUid() {
  const ref = db.collection('counters').doc('customers');
  return db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data()?.value || 0;
    const value = current + 1; tx.set(ref, { value }, { merge: true });
    return `CUST-${new Date().getUTCFullYear()}-${String(value).padStart(6, '0')}`;
  });
}
export async function nextOrderId() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const ref = db.collection('counters').doc(`orders-${day}`);
  return db.runTransaction(async tx => { const value = ((await tx.get(ref)).data()?.value || 0) + 1; tx.set(ref, { value }, { merge: true }); return `ORD-${day}-${String(value).padStart(3, '0')}`; });
}
