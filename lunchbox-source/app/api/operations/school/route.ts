import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "coordinator");
    const url = new URL(request.url);
    const schoolId = url.searchParams.get("schoolId") || "";
    const serviceDate = url.searchParams.get("serviceDate") || "";
    if (!/^[a-z0-9-]{3,60}$/.test(schoolId) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return NextResponse.json({ error: "Valid school and date are required." }, { status: 400 });
    if (!staff.isAdmin && !staff.schoolIds.includes(schoolId)) return NextResponse.json({ error: "School access denied." }, { status: 403 });

    const snapshot = await firestoreClient().collection("orders").where("status", "==", "CONFIRMED").get();
    const manifest: Array<Record<string, unknown>> = [];
    snapshot.docs.forEach((document) => {
      const order = document.data();
      if (order.school_id !== schoolId) return;
      const items = JSON.parse(String(order.items_json)) as Array<{ meal_name: string; service_date: string; quantity: number }>;
      const selected = items.filter((item) => item.service_date === serviceDate);
      if (!selected.length) return;
      manifest.push({ orderId: document.id, studentName: order.student_name, gradeBand: order.grade_band, parentPhone: order.parent_phone, allergies: JSON.parse(order.allergies_json || "[]"), items: selected });
    });
    return NextResponse.json({ schoolId, serviceDate, manifest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load school manifest." }, { status: error instanceof ParentAuthError ? 403 : 500 });
  }
}
