import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { enforceRateLimit, RateLimitError, writeAuditLog } from "@/lib/hardening";
import { toFranchiseApplication } from "@/lib/franchise-applications";
import { logError, requestId } from "@/lib/logging";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ referenceId: string }> };

function failure(error: unknown, correlationId: string) {
  const status = error instanceof ParentAuthError ? 403 : error instanceof RateLimitError ? 429 : 500;
  const message = status === 403
    ? error instanceof Error ? error.message : "Administrator access is required."
    : status === 429
      ? "Too many lookups. Please try again shortly."
      : "Unable to retrieve the franchise application.";
  if (status === 500) logError("franchise.application_lookup_failed", error, { correlationId });
  return NextResponse.json({ error: message, correlationId }, { status, headers: { "Cache-Control": "private, no-store", "X-Request-Id": correlationId } });
}

export async function GET(request: Request, context: RouteContext) {
  const correlationId = requestId(request);
  try {
    const staff = await verifyStaffRole(request, "admin");
    await enforceRateLimit("admin_franchise_application_lookup", staff.uid, 120, 3600);
    const { referenceId: rawReferenceId } = await context.params;
    const referenceId = decodeURIComponent(rawReferenceId).trim().toUpperCase();
    if (!/^FR-[A-Z0-9]{8,24}$/.test(referenceId)) {
      return NextResponse.json({ error: "Enter a valid franchise reference ID." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const snapshot = await firestoreClient().collection("franchise_applications").doc(referenceId).get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "No franchise application was found for that reference ID." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }

    await writeAuditLog(staff.uid, "franchise_application.view", "franchise_application", referenceId);
    return NextResponse.json(
      { application: toFranchiseApplication(referenceId, snapshot.data() || {}) },
      { headers: { "Cache-Control": "private, no-store", "X-Request-Id": correlationId } },
    );
  } catch (error) {
    return failure(error, correlationId);
  }
}
