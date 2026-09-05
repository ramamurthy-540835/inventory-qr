import { NextResponse } from "next/server";
import { firestoreClient, isFirestoreConfigured } from "@/lib/firestore";
import { isRazorpayConfigured } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const readiness = new URL(request.url).searchParams.get("ready") === "1";
  const checks = {
    firestore: isFirestoreConfigured(),
    storage: Boolean(process.env.GCS_BUCKET),
    firebaseWeb: process.env.REQUIRE_FIREBASE_AUTH === "false" || Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    payments: process.env.ENABLE_PAYMENTS === "false" || isRazorpayConfigured(),
  };
  if (readiness && checks.firestore) {
    try { await firestoreClient().collection("_health").limit(1).get(); }
    catch { return NextResponse.json({ status: "not_ready", checks: { ...checks, firestore: false } }, { status: 503 }); }
  }
  const required = process.env.NODE_ENV !== "production" || Object.values(checks).every(Boolean);
  return NextResponse.json({ status: required ? "ok" : "not_ready", checks }, { status: required ? 200 : 503 });
}
