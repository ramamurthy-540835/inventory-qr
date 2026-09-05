import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyParent } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { getCatalog } from "@/lib/catalog";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";

export const runtime = "nodejs";

type IncomingStudent = {
  studentName?: unknown;
  schoolId?: unknown;
  gradeBand?: unknown;
  section?: unknown;
  rollNumber?: unknown;
  relationship?: unknown;
  homeAddress?: {
    line1?: unknown;
    line2?: unknown;
    city?: unknown;
    state?: unknown;
    pincode?: unknown;
    landmark?: unknown;
  };
  allergies?: unknown;
  allergyAcknowledged?: unknown;
};

const relationships = new Set(["mother", "father", "guardian"]);

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function unauthorized(error: unknown) {
  const status = error instanceof RateLimitError ? 429 : error instanceof ParentAuthError ? 401 : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manage student profiles." }, { status });
}

export async function GET(request: Request) {
  try {
    const parent = await verifyParent(request);
    if (!parent) throw new ParentAuthError("Parent sign-in is required.");
    await enforceRateLimit("list_students", parent.uid, 60, 60);
    const snapshot = await firestoreClient().collection("students").where("parent_uid", "==", parent.uid).get();
    const students = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    return NextResponse.json({ students });
  } catch (error) {
    return unauthorized(error);
  }
}

export async function POST(request: Request) {
  try {
    const parent = await verifyParent(request);
    if (!parent) throw new ParentAuthError("Parent sign-in is required.");
    await enforceRateLimit("create_student", parent.uid, 10, 3600);
    const body = (await request.json()) as IncomingStudent;
    const studentName = cleanText(body.studentName, 100);
    const schoolId = typeof body.schoolId === "string" ? body.schoolId : "";
    const gradeBand = typeof body.gradeBand === "string" ? body.gradeBand : "";
    const section = cleanText(body.section, 20);
    const rollNumber = cleanText(body.rollNumber, 40);
    const relationship = cleanText(body.relationship, 20).toLowerCase();
    const homeAddress = {
      line1: cleanText(body.homeAddress?.line1, 160),
      line2: cleanText(body.homeAddress?.line2, 160),
      city: cleanText(body.homeAddress?.city, 80),
      state: cleanText(body.homeAddress?.state, 80),
      pincode: cleanText(body.homeAddress?.pincode, 20),
      landmark: cleanText(body.homeAddress?.landmark, 120),
    };
    const allergies = Array.isArray(body.allergies)
      ? body.allergies.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20)
      : [];
    const catalog = await getCatalog();
    const school = catalog.schools.find((entry) => entry.id === schoolId);

    if (studentName.length < 2 || studentName.length > 100 || !school || !(gradeBand in catalog.gradePlans)) {
      return NextResponse.json({ error: "Enter a valid student name, school and grade." }, { status: 400 });
    }
    if (!relationships.has(relationship)) {
      return NextResponse.json({ error: "Choose the parent relationship to the student." }, { status: 400 });
    }
    if (!homeAddress.line1 || !homeAddress.city || !homeAddress.state || !/^\d{6}$/.test(homeAddress.pincode)) {
      return NextResponse.json({ error: "Enter a complete home address with a valid 6-digit pincode." }, { status: 400 });
    }
    if (body.allergyAcknowledged !== true) {
      return NextResponse.json({ error: "Parent allergy acknowledgement is required." }, { status: 400 });
    }

    const duplicateQuery = firestoreClient().collection("students")
      .where("parent_uid", "==", parent.uid)
      .where("school_id", "==", schoolId)
      .where("student_name_key", "==", studentName.toLowerCase());
    const duplicateSnapshot = await duplicateQuery.limit(10).get();
    const duplicate = duplicateSnapshot.docs.some((document) => {
      const existingRoll = String(document.get("roll_number") || "").toLowerCase();
      return rollNumber ? existingRoll === rollNumber.toLowerCase() : !existingRoll;
    });
    if (duplicate) {
      return NextResponse.json({ error: "This student profile already exists for the selected school." }, { status: 409 });
    }

    const reference = firestoreClient().collection("students").doc();
    await reference.create({
      parent_uid: parent.uid,
      parent_phone: parent.phone,
      student_name: studentName,
      student_name_key: studentName.toLowerCase(),
      school_id: schoolId,
      school_name: school.name,
      city: school.city,
      grade_band: gradeBand,
      section,
      roll_number: rollNumber,
      relationship,
      home_address: homeAddress,
      allergies,
      allergy_acknowledged: true,
      allergy_acknowledged_at: FieldValue.serverTimestamp(),
      active: true,
      status: "active",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      id: reference.id,
      studentName,
      schoolId,
      gradeBand,
      section,
      rollNumber,
      relationship,
      homeAddress,
      allergies,
    }, { status: 201 });
  } catch (error) {
    return unauthorized(error);
  }
}
