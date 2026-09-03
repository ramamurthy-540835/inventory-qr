import { db, FieldValue } from '../firebase/admin.js';

export async function audit({ orderId, customerUid, eventType, user, status, metadata = {}, location, deviceInfo }) {
  const event = { orderId: orderId || null, customerUid: customerUid || null, eventType, performedBy: user?.uid || 'system', userRole: user?.role || 'SYSTEM', timestamp: FieldValue.serverTimestamp(), status: status || null, metadata, location: location || null, deviceInfo: deviceInfo || null };
  await db.collection('deliveryEvents').add(event);
  // Cloud Run service account needs BigQuery Data Editor; Firestore remains source of truth if this sink is unavailable.
  import('../services/bigquery.js').then(({ streamEvent }) => streamEvent(event)).catch(() => {});
}
