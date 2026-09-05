import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { firestoreClient } from "@/lib/firestore";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";
import { franchiseApplicationSchema } from "@/lib/validation/franchise";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = franchiseApplicationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please correct the highlighted details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { name, companyName, category, address, area, phone, website, contactName, email, latitude, longitude, opportunityId, city } = parsed.data;
    await enforceRateLimit("franchise_application", request.headers.get("x-forwarded-for") || "unknown", 5, 3600);
    const reference = firestoreClient().collection("franchise_applications").doc();
    await reference.create({ name, companyName, category, address, area, city, phone, website, contactName, email, opportunityId: opportunityId || null, latitude: typeof latitude === "number" ? latitude : null, longitude: typeof longitude === "number" ? longitude : null, documentPaths: [], status: "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ id: reference.id, status: "pending" }, { status: 201 });
  } catch (error) {
    const status = error instanceof RateLimitError ? 429 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit your application." }, { status });
  }
}
