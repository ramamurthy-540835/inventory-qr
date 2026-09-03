import { Router } from 'express';
import crypto from 'node:crypto';
import { db, FieldValue } from '../firebase/admin.js';
import { allowRoles } from '../middleware/auth.js';
import { audit } from '../services/audit.js';

const router = Router();
const admin = allowRoles('SUPER_ADMIN', 'ADMIN');
const basicAuth = () => `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
const configured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);

function safeEqual(expected, received) {
  return Boolean(received) && expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
function validWebhook(body, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  return safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex'), signature);
}
function validCallback(query) {
  const values = [query.razorpay_payment_link_id, query.razorpay_payment_link_reference_id, query.razorpay_payment_link_status, query.razorpay_payment_id];
  if (!process.env.RAZORPAY_KEY_SECRET || values.some(value => !value)) return false;
  return safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(values.join('|')).digest('hex'), query.razorpay_signature);
}
async function findOrder(paymentLinkId) {
  const snapshot = await db.collection('orders').where('razorpayPaymentLinkId', '==', paymentLinkId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}
async function confirmPayment(paymentLinkId, paymentId) {
  const orderRef = await findOrder(paymentLinkId);
  if (!orderRef) throw Object.assign(new Error('Order for payment link was not found'), { status: 404 });
  let order;
  let newlyPaid = false;
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(orderRef.ref);
    order = snapshot.data();
    if (order.paymentStatus === 'PAID') return;
    tx.update(orderRef.ref, {
      paymentStatus: 'PAID', razorpayPaymentId: paymentId, razorpayPaymentLinkStatus: 'paid',
      paymentReceivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    newlyPaid = true;
  });
  if (newlyPaid) await audit({ orderId: order.orderId, customerUid: order.customerUid, eventType: 'PAYMENT_RECEIVED', status: 'PAID', metadata: { paymentLinkId, paymentId } });
  return { ...order, paymentStatus: 'PAID' };
}

router.post('/orders/:orderId/payment-link', admin, async (req, res, next) => { try {
  if (!configured()) return res.status(503).json({ error: 'Razorpay is not configured' });
  const orderRef = db.collection('orders').doc(req.params.orderId);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists) return res.status(404).json({ error: 'Order not found' });
  const order = orderSnapshot.data();
  if (order.paymentStatus === 'PAID') return res.status(409).json({ error: 'Order is already paid' });
  if (order.razorpayPaymentLinkId && order.paymentLinkUrl) return res.json({ orderId: order.orderId, paymentStatus: order.paymentStatus, paymentLinkUrl: order.paymentLinkUrl });
  const customerSnapshot = await db.collection('customers').where('customerUid', '==', order.customerUid).limit(1).get();
  if (customerSnapshot.empty) return res.status(404).json({ error: 'Customer not found' });
  const customer = customerSnapshot.docs[0].data();
  const itemSnapshot = await db.collection('orderItems').where('orderId', '==', order.orderId).get();
  if (itemSnapshot.empty) return res.status(409).json({ error: 'Add at least one order item before requesting payment' });
  const items = itemSnapshot.docs.map(doc => doc.data());
  if (items.some(item => !Number.isFinite(Number(item.unitPrice)))) return res.status(422).json({ error: 'Every order item needs unitPrice before requesting payment' });
  const totalAmount = items.reduce((total, item) => total + Number(item.quantity) * Number(item.unitPrice), 0);
  const amount = Math.round(totalAmount * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) return res.status(422).json({ error: 'Order total must be at least INR 1.00' });
  const payload = { amount, currency: 'INR', reference_id: order.orderId, description: `Grocery order ${order.orderId}`, customer: { name: customer.name }, notify: { sms: Boolean(customer.mobile), email: Boolean(customer.email) }, reminder_enable: true, notes: { order_id: order.orderId, customer_uid: order.customerUid } };
  if (customer.mobile) payload.customer.contact = String(customer.mobile);
  if (customer.email) payload.customer.email = customer.email;
  if (process.env.RAZORPAY_CALLBACK_URL) { payload.callback_url = process.env.RAZORPAY_CALLBACK_URL; payload.callback_method = 'get'; }
  const response = await fetch('https://api.razorpay.com/v1/payment_links', { method: 'POST', headers: { authorization: basicAuth(), 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const link = await response.json();
  if (!response.ok) throw Object.assign(new Error(link.error?.description || 'Razorpay could not create the payment link'), { status: 502 });
  await orderRef.update({ paymentStatus: 'PENDING', totalAmount, currency: 'INR', razorpayPaymentLinkId: link.id, razorpayPaymentLinkStatus: link.status, paymentLinkUrl: link.short_url, paymentRequestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await audit({ orderId: order.orderId, customerUid: order.customerUid, eventType: 'PAYMENT_LINK_CREATED', user: req.user, status: 'PENDING', metadata: { paymentLinkId: link.id, totalAmount } });
  res.status(201).json({ orderId: order.orderId, paymentStatus: 'PENDING', totalAmount, paymentLinkUrl: link.short_url, message: 'Payment link created. Complete payment to confirm the order.' });
} catch (error) { next(error); } });

export async function razorpayWebhook(req, res, next) { try {
  if (!validWebhook(req.body, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Invalid Razorpay webhook signature' });
  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event !== 'payment_link.paid') return res.json({ received: true });
  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  if (!link?.id || !payment?.id || link.status !== 'paid') return res.status(400).json({ error: 'Invalid payment_link.paid payload' });
  const order = await confirmPayment(link.id, payment.id);
  res.json({ received: true, orderId: order.orderId, message: 'Payment received. Your order is confirmed.' });
} catch (error) { next(error); } }

export async function razorpayCallback(req, res, next) { try {
  if (!validCallback(req.query)) return res.status(400).json({ error: 'Invalid Razorpay payment callback signature' });
  if (req.query.razorpay_payment_link_status !== 'paid') return res.json({ paymentStatus: req.query.razorpay_payment_link_status, message: 'Payment is not complete yet.' });
  const order = await confirmPayment(req.query.razorpay_payment_link_id, req.query.razorpay_payment_id);
  res.json({ orderId: order.orderId, paymentStatus: 'PAID', message: 'Payment received. Your order is confirmed.' });
} catch (error) { next(error); } }

export default router;
