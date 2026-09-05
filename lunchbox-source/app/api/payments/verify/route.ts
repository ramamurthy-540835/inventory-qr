import { NextResponse } from "next/server";
import { verifyParent } from "@/lib/firebase-admin";
import { confirmCapturedPayment } from "@/lib/firestore";
import { fetchPayment, verifyCheckoutSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parent = await verifyParent(request);
    const body = await request.json() as Record<string, unknown>;
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: "Payment signature is invalid." }, { status: 400 });
    }
    const payment = await fetchPayment(paymentId);
    if (payment.status !== "captured" || payment.order_id !== orderId || payment.currency !== "INR") {
      return NextResponse.json({ error: "Payment has not been captured." }, { status: 409 });
    }
    const confirmed = await confirmCapturedPayment(orderId, paymentId, Number(payment.amount), parent?.uid);
    return NextResponse.json({ confirmed: true, orderId: confirmed.orderId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify payment." }, { status: 500 });
  }
}
