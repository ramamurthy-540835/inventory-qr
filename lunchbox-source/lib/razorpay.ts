import { createHmac, timingSafeEqual } from "node:crypto";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

export function isRazorpayConfigured() {
  return process.env.ENABLE_PAYMENTS !== "false" && Boolean(keyId && keySecret);
}

export function isFranchisePaymentLinksConfigured() {
  const amount = Number(process.env.FRANCHISE_PAYMENT_AMOUNT_INR || 0);
  return process.env.FRANCHISE_PAYMENT_ENABLED === "true" && isRazorpayConfigured() && Number.isInteger(amount) && amount > 0;
}

export async function createFranchisePaymentLink(input: { applicationId: string; name: string; email: string; phone: string; callbackUrl: string }) {
  const amountInr = Number(process.env.FRANCHISE_PAYMENT_AMOUNT_INR || 0);
  if (!isFranchisePaymentLinksConfigured()) throw new Error("Franchise payment links are not enabled.");
  const response = await fetch("https://api.razorpay.com/v1/payment_links/", { method: "POST", headers: { Authorization: authorization(), "Content-Type": "application/json" }, body: JSON.stringify({ amount: amountInr * 100, currency: "INR", accept_partial: false, reference_id: `FR-${input.applicationId}`.slice(0, 40), description: "LunchBox franchise application payment", customer: { name: input.name, email: input.email, contact: `+91${input.phone.replace(/\D/g, "").slice(-10)}` }, notify: { sms: true, email: true }, reminder_enable: true, expire_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, callback_url: input.callbackUrl, callback_method: "get", notes: { application_id: input.applicationId, payment_type: "franchise_application" } }) });
  const data = await response.json() as { id?: string; short_url?: string; status?: string; amount?: number; error?: { description?: string } };
  if (!response.ok || !data.id || !data.short_url) throw new Error(data.error?.description || "Unable to create the secure payment link.");
  return { id: data.id, shortUrl: data.short_url, status: data.status || "created", amount: data.amount || amountInr * 100 };
}

export function paymentCheckoutDetails(id: string, amountInr: number) {
  if (!keyId) throw new Error("Razorpay is not configured.");
  return { id, amount: amountInr * 100, currency: "INR", keyId };
}

function authorization() {
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createPaymentOrder(appOrderId: string, amountInr: number) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: authorization(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountInr * 100, currency: "INR", receipt: appOrderId.slice(0, 40), notes: { app: "lunchbox", app_order_id: appOrderId } }),
  });
  const data = await response.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.description || "Unable to initialize payment.");
  return { id: data.id, amount: data.amount!, currency: data.currency!, keyId: keyId! };
}

export function verifyCheckoutSignature(serverOrderId: string, paymentId: string, signature: string) {
  if (!keySecret) return false;
  const expected = createHmac("sha256", keySecret).update(`${serverOrderId}|${paymentId}`).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  if (!webhookSecret) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function fetchPayment(paymentId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authorization() } });
  const data = await response.json() as { id?: string; order_id?: string; amount?: number; currency?: string; status?: string };
  if (!response.ok) throw new Error("Unable to verify payment status.");
  return data;
}

export async function createRefund(paymentId: string, amountPaise: number, idempotencyKey: string, reason: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { Authorization: authorization(), "Content-Type": "application/json", "X-Refund-Idempotency": idempotencyKey },
    body: JSON.stringify({ amount: amountPaise, speed: "normal", receipt: idempotencyKey.slice(0, 40), notes: { reason: reason.slice(0, 256) } }),
  });
  const data = await response.json() as { id?: string; status?: string; amount?: number; error?: { description?: string } };
  if (!response.ok || !data.id) throw new Error(data.error?.description || "Unable to initiate refund.");
  return data as { id: string; status: string; amount: number };
}
