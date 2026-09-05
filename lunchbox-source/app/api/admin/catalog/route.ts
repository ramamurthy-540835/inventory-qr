import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/hardening";
import { MARKET_PRICE } from "@/lib/pricing";

export const runtime = "nodejs";



function fail(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to update catalogue." },
    { status: error instanceof ParentAuthError ? 403 : 500 },
  );
}

export async function PUT(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "admin");
    const body = await request.json() as Record<string, unknown>;
    const entity = body.entity;
    const firestore = firestoreClient();
    const audit = { updated_at: FieldValue.serverTimestamp(), updated_by: staff.uid };

    if (entity === "school") {
      const id = String(body.schoolId || "").trim();
      const name = String(body.schoolName || "").trim();
      const cityId = String(body.cityId || "");
      const kitchenId = String(body.kitchenId || "").trim();
      const area = String(body.area || "").trim();
      const priceTier = body.priceTier === "sponsored" ? "sponsored" : "market";
      if (!/^[a-z0-9-]{3,60}$/.test(id) || name.length < 3 || !/^[a-z0-9-]{3,40}$/.test(cityId) || !/^[a-z0-9-]{3,50}$/.test(kitchenId) || !area) {
        return NextResponse.json({ error: "Enter valid school, city, kitchen and area values." }, { status: 400 });
      }
      await firestore.collection("schools").doc(id).set({ school_name: name, city_id: cityId, kitchen_id: kitchenId, area, price_tier: priceTier, active: body.active !== false, ...audit }, { merge: true });
      await writeAuditLog(staff.uid, "school.upsert", "school", id, { cityId, kitchenId, priceTier, active: body.active !== false });
      return NextResponse.json({ id, updated: true });
    }

    if (entity === "meal") {
      const id = String(body.mealId || "").trim();
      const serviceDate = String(body.serviceDate || "");
      const name = String(body.mealName || "").trim();
      if (!/^[a-z0-9-]{3,80}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || name.length < 3) {
        return NextResponse.json({ error: "Enter a valid meal ID, service date and name." }, { status: 400 });
      }
      const date = new Date(`${serviceDate}T00:00:00+05:30`);
      await firestore.collection("meal_packages").doc(id).set({ service_date: serviceDate, day: new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(date), short_date: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(date), meal_name: name, description: String(body.description || ""), tags: ["Vegetarian"], protein_g: Number(body.protein || 0), calories: Number(body.calories || 0), price_inr: MARKET_PRICE, rating: Number(body.rating || 0), color: String(body.color || "green"), emoji: "🍱", nutrition_status: "provisional", is_available: body.active !== false, ...audit }, { merge: true });
      await writeAuditLog(staff.uid, "meal.upsert", "meal", id, { serviceDate, price: MARKET_PRICE, active: body.active !== false });
      return NextResponse.json({ id, updated: true });
    }

    if (entity === "holiday") {
      const schoolId = String(body.schoolId || "").trim();
      const serviceDate = String(body.serviceDate || "");
      if (!/^[a-z0-9-]{3,60}$/.test(schoolId) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
        return NextResponse.json({ error: "Enter a valid school and holiday date." }, { status: 400 });
      }
      const id = `${schoolId}_${serviceDate}`;
      await firestore.collection("school_holidays").doc(id).set({ school_id: schoolId, service_date: serviceDate, reason: String(body.reason || "School closed"), active: body.active !== false, ...audit }, { merge: true });
      await writeAuditLog(staff.uid, "holiday.upsert", "school_holiday", id, { schoolId, serviceDate, active: body.active !== false });
      return NextResponse.json({ id, updated: true });
    }

    if (entity === "grade") {
      const gradeBand = String(body.gradeBand || "").trim();
      const label = String(body.label || "").trim();
      const targetCalories = Number(body.targetCalories);
      const targetProteinG = Number(body.targetProteinG);
      const sortOrder = Number(body.sortOrder);
      if (!/^[0-9-]{3,10}$/.test(gradeBand) || !label || !Number.isInteger(targetCalories) || targetCalories < 1 || !Number.isFinite(targetProteinG) || targetProteinG < 1 || !Number.isInteger(sortOrder)) return NextResponse.json({ error: "Enter a valid grade nutrition plan." }, { status: 400 });
      await firestore.collection("grade_nutrition_plans").doc(gradeBand).set({ label, target_calories: targetCalories, target_protein_g: targetProteinG, sort_order: sortOrder, nutrition_status: "provisional", active: body.active !== false, ...audit }, { merge: true });
      await writeAuditLog(staff.uid, "grade.upsert", "grade_nutrition_plan", gradeBand, { targetCalories, targetProteinG, active: body.active !== false });
      return NextResponse.json({ id: gradeBand, updated: true });
    }
    return NextResponse.json({ error: "Unsupported catalogue entity." }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
