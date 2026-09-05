import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/hardening";
import { mealEnrollmentStatuses, mealEnrollmentTypes, normalizeMealEnrollment, type MealEnrollmentStatus, type MealEnrollmentType } from "@/lib/meal-enrollment-admin";

export const runtime = "nodejs";
const collection = "meal_enrollment_requests";
function failure(error: unknown) { const status = error instanceof ParentAuthError ? 403 : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manage meal registrations." }, { status }); }

export async function GET(request: Request) {
  try {
    await verifyStaffRole(request, "admin");
    const url = new URL(request.url);
    const snapshot = await firestoreClient().collection(collection).orderBy("created_at", "desc").limit(300).get();
    let registrations = snapshot.docs.map((document) => normalizeMealEnrollment(document.id, document.data()));
    const type = (url.searchParams.get("type") || "").toUpperCase(); const status = (url.searchParams.get("status") || "").toUpperCase();
    const city = (url.searchParams.get("city") || "").toUpperCase(); const zone = (url.searchParams.get("zone") || "").toUpperCase();
    const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("en-IN").slice(0, 100);
    if (mealEnrollmentTypes.includes(type as MealEnrollmentType)) registrations = registrations.filter((item) => item.registrationType === type);
    if (mealEnrollmentStatuses.includes(status as MealEnrollmentStatus)) registrations = registrations.filter((item) => item.status === status);
    if (city) registrations = registrations.filter((item) => item.cityCode === city); if (zone) registrations = registrations.filter((item) => item.zoneCode === zone);
    if (query) registrations = registrations.filter((item) => `${item.registrationId} ${item.personName} ${item.guardianName || ""} ${item.locationName} ${item.contactPhone}`.toLocaleLowerCase("en-IN").includes(query));
    const summary = Object.fromEntries(mealEnrollmentStatuses.map((item) => [item, registrations.filter((record) => record.status === item).length]));
    return NextResponse.json({ registrations, summary, total: registrations.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "admin"); const body = await request.json() as Record<string, unknown>;
    const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim().slice(0, 100) : "";
    const status = typeof body.status === "string" ? body.status.toUpperCase() as MealEnrollmentStatus : "RECEIVED";
    const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim().slice(0, 120) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : ""; const followUpDate = typeof body.followUpDate === "string" ? body.followUpDate : "";
    if (!/^[A-Z0-9-]{8,100}$/i.test(registrationId) || !mealEnrollmentStatuses.includes(status)) return NextResponse.json({ error: "Choose a valid registration and status." }, { status: 400 });
    let followUpAt: Timestamp | null = null; if (followUpDate) { const parsed = new Date(`${followUpDate}T09:00:00+05:30`); if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Enter a valid follow-up date." }, { status: 400 }); followUpAt = Timestamp.fromDate(parsed); }
    const reference = firestoreClient().collection(collection).doc(registrationId); if (!(await reference.get()).exists) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    await reference.set({ status, assigned_to: assignedTo || null, internal_notes: notes || null, follow_up_at: followUpAt, updated_at: FieldValue.serverTimestamp(), updated_by: staff.uid, workflow_history: FieldValue.arrayUnion({ status, changed_by: staff.uid, changed_at: Timestamp.now() }) }, { merge: true });
    await writeAuditLog(staff.uid, "meal_enrollment.update", "meal_enrollment", registrationId, { status, assignedTo, hasNotes: Boolean(notes) });
    return NextResponse.json({ updated: true, registrationId, status });
  } catch (error) { return failure(error); }
}
