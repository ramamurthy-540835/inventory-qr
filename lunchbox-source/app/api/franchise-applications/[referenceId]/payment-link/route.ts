import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { firestoreClient } from "@/lib/firestore";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";
import { createFranchisePaymentLink, isFranchisePaymentLinksConfigured } from "@/lib/razorpay";

export const runtime = "nodejs";
type Context = { params: Promise<{ referenceId: string }> };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: Request, { params }: Context) {
  try {
    const { referenceId } = await params;
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(referenceId)) return NextResponse.json({ error: "Invalid application reference." }, { status: 400 });
    if (!isFranchisePaymentLinksConfigured()) return NextResponse.json({ error: "Franchise payments are not enabled yet. Please wait for a verified payment request." }, { status: 409 });
    await enforceRateLimit("franchise_payment_link", request.headers.get("x-forwarded-for") || "unknown", 5, 3600);
    const reference = firestoreClient().collection("franchise_applications").doc(referenceId);
    const snapshot = await reference.get(); if (!snapshot.exists) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const application = snapshot.data() || {}; const existing = application.paymentLink as { shortUrl?: unknown; status?: unknown } | undefined;
    if (existing && text(existing.shortUrl) && text(existing.status) !== "paid") return NextResponse.json({ url: text(existing.shortUrl), reused: true });
    const callbackUrl = new URL(`/franchise/payment?applicationId=${encodeURIComponent(referenceId)}`, request.url).toString();
    const link = await createFranchisePaymentLink({ applicationId: referenceId, name: text(application.contactName) || text(application.name), email: text(application.email), phone: text(application.phone), callbackUrl });
    await reference.set({ paymentLink: { id: link.id, shortUrl: link.shortUrl, status: link.status, amountPaise: link.amount, createdAt: FieldValue.serverTimestamp() }, paymentStatus: "payment_link_created", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ url: link.shortUrl });
  } catch (error) { const status = error instanceof RateLimitError ? 429 : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create the payment link." }, { status }); }
}
