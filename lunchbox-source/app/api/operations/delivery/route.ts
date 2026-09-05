import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { storeDeliveryProof } from "@/lib/gcp";

export const runtime = "nodejs";

function validScope(staff: Awaited<ReturnType<typeof verifyStaffRole>>, routeId: string) {
  return staff.isAdmin || staff.routeIds.includes(routeId);
}

export async function GET(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "driver");
    const url = new URL(request.url);
    const routeId = url.searchParams.get("routeId") || "";
    const serviceDate = url.searchParams.get("serviceDate") || "";
    if (!/^[a-z0-9-]{3,60}$/.test(routeId) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return NextResponse.json({ error: "Valid route and date are required." }, { status: 400 });
    if (!validScope(staff, routeId)) return NextResponse.json({ error: "Route access denied." }, { status: 403 });
    const snapshot = await firestoreClient().collection("route_stops_daily").where("route_id", "==", routeId).where("service_date", "==", serviceDate).get();
    const stops = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data(), stopSequence: Number(document.get("stop_sequence") || 0) }))
      .sort((a, b) => a.stopSequence - b.stopSequence);
    return NextResponse.json({ routeId, serviceDate, stops });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load delivery route." }, { status: error instanceof ParentAuthError ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "driver");
    const form = await request.formData();
    const routeId = String(form.get("routeId") || "");
    const schoolId = String(form.get("schoolId") || "");
    const serviceDate = String(form.get("serviceDate") || "");
    const file = form.get("proof");
    if (!validScope(staff, routeId)) return NextResponse.json({ error: "Route access denied." }, { status: 403 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !/^[a-z0-9-]{3,60}$/.test(routeId) || !/^[a-z0-9-]{3,60}$/.test(schoolId) || !(file instanceof File)) {
      return NextResponse.json({ error: "Route, school, date and delivery photo are required." }, { status: 400 });
    }
    const proofUri = await storeDeliveryProof(serviceDate, routeId, schoolId, file);
    const id = `${serviceDate}_${routeId}_${schoolId}`;
    await firestoreClient().collection("route_stops_daily").doc(id).set({
      service_date: serviceDate,
      route_id: routeId,
      school_id: schoolId,
      status: "DELIVERED",
      delivered_at: FieldValue.serverTimestamp(),
      delivered_by: staff.uid,
      proof_uri: proofUri,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ delivered: true, proofUri });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm delivery." }, { status: error instanceof ParentAuthError ? 403 : 500 });
  }
}
