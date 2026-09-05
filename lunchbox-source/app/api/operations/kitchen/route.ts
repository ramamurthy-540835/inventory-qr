import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "kitchen");
    const url = new URL(request.url);
    const kitchenId = url.searchParams.get("kitchenId") || "";
    const serviceDate = url.searchParams.get("serviceDate") || "";
    if (!/^[a-z0-9-]{3,50}$/.test(kitchenId) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return NextResponse.json({ error: "Valid kitchen and service date are required." }, { status: 400 });
    }
    if (!staff.isAdmin && !staff.kitchenIds.includes(kitchenId)) return NextResponse.json({ error: "Kitchen access denied." }, { status: 403 });

    const snapshot = await firestoreClient().collection("orders").where("status", "==", "CONFIRMED").get();
    const totals = new Map<string, { mealId: string; mealName: string; quantity: number; schools: Record<string, number> }>();
    for (const document of snapshot.docs) {
      const order = document.data();
      if (order.kitchen_id !== kitchenId) continue;
      const items = JSON.parse(String(order.items_json)) as Array<{ meal_id: string; meal_name: string; service_date: string; quantity: number }>;
      for (const item of items.filter((candidate) => candidate.service_date === serviceDate)) {
        const total = totals.get(item.meal_id) || { mealId: item.meal_id, mealName: item.meal_name, quantity: 0, schools: {} };
        total.quantity += item.quantity;
        total.schools[order.school_name] = (total.schools[order.school_name] || 0) + item.quantity;
        totals.set(item.meal_id, total);
      }
    }
    return NextResponse.json({ kitchenId, serviceDate, totals: [...totals.values()] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load production totals." }, { status: error instanceof ParentAuthError ? 403 : 500 });
  }
}
