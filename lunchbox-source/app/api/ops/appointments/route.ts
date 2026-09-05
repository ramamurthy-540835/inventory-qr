import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/hardening";

export const runtime = "nodejs";

const staffRoles = new Set(["head cook", "assistant cook", "helper", "rider", "cleaner"]);
const meetingPurposes = new Set(["principal meeting", "tasting day", "PTA presentation"]);
const meetingStatuses = new Set(["planned", "done", "follow-up"]);

function validKitchen(value: string) { return /^[a-z0-9-]{3,50}$/.test(value); }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function responseError(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manage appointments." }, { status: error instanceof ParentAuthError ? 403 : 500 });
}

export async function GET(request: Request) {
  try {
    await verifyStaffRole(request, "admin");
    const kitchenId = new URL(request.url).searchParams.get("kitchenId") || "";
    if (!validKitchen(kitchenId)) return NextResponse.json({ error: "Valid kitchen is required." }, { status: 400 });
    const kitchen = firestoreClient().collection("kitchens").doc(kitchenId);
    const [staffSnapshot, meetingSnapshot] = await Promise.all([
      kitchen.collection("staff_appointments").get(),
      kitchen.collection("school_meetings").get(),
    ]);
    const staff = staffSnapshot.docs.map((document) => ({ id: document.id, ...document.data() } as { id: string } & Record<string, unknown>)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const meetings = meetingSnapshot.docs.map((document) => ({ id: document.id, ...document.data() } as { id: string } & Record<string, unknown>)).sort((a, b) => String(a.date_time).localeCompare(String(b.date_time)));
    const warningLimit = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const certificateWarnings = staff.filter((person) => person.active !== false && String(person.medical_cert_expiry) <= warningLimit);
    const upcomingMeetings = meetings.filter((meeting) => meeting.active !== false && meeting.status !== "done" && String(meeting.date_time) >= new Date().toISOString());
    return NextResponse.json({ staff, meetings, certificateWarnings, upcomingMeetings });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await verifyStaffRole(request, "admin");
    const body = await request.json() as Record<string, unknown>;
    const kitchenId = String(body.kitchenId || "");
    const recordType = String(body.recordType || "");
    const recordId = String(body.id || "");
    if (!validKitchen(kitchenId) || (recordId && !/^[A-Za-z0-9_-]{3,100}$/.test(recordId))) return NextResponse.json({ error: "Valid kitchen and record ID are required." }, { status: 400 });
    const kitchen = firestoreClient().collection("kitchens").doc(kitchenId);

    if (recordType === "staff") {
      const name = String(body.name || "").trim();
      const role = String(body.role || "");
      const salary = Number(body.monthlySalary);
      const joiningDate = String(body.joiningDate || "");
      const phone = String(body.phone || "");
      const medicalCertExpiry = String(body.medicalCertExpiry || "");
      if (name.length < 2 || !staffRoles.has(role) || !Number.isFinite(salary) || salary < 0 || !validDate(joiningDate) || !/^[6-9]\d{9}$/.test(phone) || !validDate(medicalCertExpiry)) {
        return NextResponse.json({ error: "Enter valid staff appointment details." }, { status: 400 });
      }
      const reference = recordId ? kitchen.collection("staff_appointments").doc(recordId) : kitchen.collection("staff_appointments").doc();
      await reference.set({ name, role, monthly_salary: salary, joining_date: joiningDate, phone, medical_cert_expiry: medicalCertExpiry, active: body.active !== false, updated_at: FieldValue.serverTimestamp(), updated_by: admin.uid }, { merge: true });
      await writeAuditLog(admin.uid, "staff_appointment.upsert", "staff_appointment", reference.id, { kitchenId, active: body.active !== false });
      return NextResponse.json({ id: reference.id, updated: true });
    }

    if (recordType === "meeting") {
      const schoolId = String(body.schoolId || "").trim();
      const schoolName = String(body.schoolName || "").trim();
      const contactPerson = String(body.contactPerson || "").trim();
      const dateTime = String(body.dateTime || "");
      const purpose = String(body.purpose || "");
      const status = String(body.status || "planned");
      const notes = String(body.notes || "").trim().slice(0, 2000);
      if (!/^[a-z0-9-]{3,60}$/.test(schoolId) || schoolName.length < 3 || contactPerson.length < 2 || Number.isNaN(Date.parse(dateTime)) || !meetingPurposes.has(purpose) || !meetingStatuses.has(status)) {
        return NextResponse.json({ error: "Enter valid school meeting details." }, { status: 400 });
      }
      const reference = recordId ? kitchen.collection("school_meetings").doc(recordId) : kitchen.collection("school_meetings").doc();
      await reference.set({ school_id: schoolId, school_name: schoolName, contact_person: contactPerson, date_time: new Date(dateTime).toISOString(), purpose, status, notes, active: body.active !== false, updated_at: FieldValue.serverTimestamp(), updated_by: admin.uid }, { merge: true });
      await writeAuditLog(admin.uid, "school_meeting.upsert", "school_meeting", reference.id, { kitchenId, status });
      return NextResponse.json({ id: reference.id, updated: true });
    }

    return NextResponse.json({ error: "Unsupported appointment type." }, { status: 400 });
  } catch (error) {
    return responseError(error);
  }
}
