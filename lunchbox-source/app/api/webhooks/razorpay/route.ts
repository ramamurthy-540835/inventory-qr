import { NextResponse } from "next/server";
import { FieldValue } from "@google-cloud/firestore";
import { confirmCapturedPayment, firestoreClient, updateRefundStatus } from "@/lib/firestore";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; notes?: { app?: string } } };
    payment_link?: { entity?: { id?: string; status?: string; reference_id?: string; notes?: { application_id?: string } } };
    refund?: { entity?: { id?: string; status?: string; notes?: { app?: string } } };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Razorpay-Signature") || "";
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as RazorpayEvent;
  if (event.event === "payment_link.paid") {
    const link = event.payload?.payment_link?.entity;
    const applicationId = link?.notes?.application_id;
    if (!link?.id || !applicationId || link.status !== "paid") return NextResponse.json({ error: "Invalid payment-link payload." }, { status: 400 });
    await firestoreClient().collection("franchise_applications").doc(applicationId).set({ paymentStatus: "paid", paymentLink: { id: link.id, status: "paid", paidAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ accepted: true });
  }
  if (["refund.created", "refund.processed", "refund.failed"].includes(event.event || "")) {
    const refund = event.payload?.refund?.entity;
    if (!refund?.id || !refund.status) return NextResponse.json({ error: "Invalid refund payload." }, { status: 400 });
    await updateRefundStatus(refund.id, refund.status);
    return NextResponse.json({ accepted: true });
  }
  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return NextResponse.json({ accepted: true, ignored: true });
  }
  const payment = event.payload?.payment?.entity;
  if (payment?.notes?.app !== "lunchbox") return NextResponse.json({ accepted: true, ignored: true });
  if (!payment?.id || !payment.order_id || payment.status !== "captured" || payment.currency !== "INR" || !Number.isInteger(payment.amount)) {
    return NextResponse.json({ error: "Invalid captured-payment payload." }, { status: 400 });
  }
  await confirmCapturedPayment(payment.order_id, payment.id, payment.amount!);
  return NextResponse.json({ accepted: true });
}
