import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient, OrderConflictError, prepareFullRefund, recordRefund } from "@/lib/firestore";
import { createRefund } from "@/lib/razorpay";
import { enforceRateLimit, RateLimitError, writeAuditLog } from "@/lib/hardening";

export const runtime = "nodejs";

function failure(error: unknown) {
  const status = error instanceof RateLimitError ? 429 : error instanceof ParentAuthError ? 403 : error instanceof OrderConflictError ? 409 : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manage payments." }, { status });
}

export async function GET(request: Request) {
  try {
    await verifyStaffRole(request, "admin");
    const snapshot = await firestoreClient().collection("orders").limit(200).get();
    const orders = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        status: data.status,
        totalInr: data.total_inr,
        createdAt: data.created_at,
        razorpayOrderId: data.razorpay_order_id || null,
        paymentId: data.razorpay_payment_id || null,
        refundId: data.razorpay_refund_id || null,
        analyticsStatus: data.analytics_status,
      };
    });
    return NextResponse.json({ orders });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "admin");
    await enforceRateLimit("admin_refund", staff.uid, 10, 3600);
    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(idempotencyKey)) return NextResponse.json({ error: "A valid refund idempotency key is required." }, { status: 400 });
    const body = await request.json() as { orderId?: unknown; reason?: unknown };
    const orderId = String(body.orderId || "");
    const reason = String(body.reason || "Customer cancellation").trim();
    if (!/^LB-[0-9a-f-]{36}$/.test(orderId) || reason.length < 3) return NextResponse.json({ error: "Enter a valid order ID and reason." }, { status: 400 });
    const prepared = await prepareFullRefund(orderId, idempotencyKey, staff.uid, reason);
    const refund = await createRefund(prepared.paymentId, prepared.amountPaise, idempotencyKey, reason);
    await recordRefund(orderId, refund);
    await writeAuditLog(staff.uid, "payment.refund", "order", orderId, { refundId: refund.id, amountPaise: refund.amount, reason });
    return NextResponse.json({ orderId, refundId: refund.id, status: refund.status });
  } catch (error) { return failure(error); }
}
