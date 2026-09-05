import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { writeAuditLog } from "@/lib/hardening";
import { dailyExpenseTotal, initialOperationsPlan, monthlyPayroll, normalizeDailyExpenses, type OperationsPlan } from "@/lib/operations-costs";

export const runtime = "nodejs";

function validKitchen(value: string) { return /^[a-z0-9-]{3,50}$/.test(value); }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof ParentAuthError ? error.message : "Unable to manage operating costs." },
    { status: error instanceof ParentAuthError ? 403 : 500 },
  );
}

async function loadPlan(): Promise<OperationsPlan> {
  const snapshot = await firestoreClient().collection("operations_plans").doc("default").get();
  return snapshot.exists ? snapshot.data() as OperationsPlan : initialOperationsPlan;
}

export async function GET(request: Request) {
  try {
    await verifyStaffRole(request, "admin");
    const url = new URL(request.url);
    const kitchenId = url.searchParams.get("kitchenId") || "";
    const serviceDate = url.searchParams.get("serviceDate") || "";
    if (!validKitchen(kitchenId) || !validDate(serviceDate)) return NextResponse.json({ error: "Valid kitchen and service date are required." }, { status: 400 });

    const firestore = firestoreClient();
    const monthStart = `${serviceDate.slice(0, 7)}-01`;
    const [plan, daySnapshot, monthSnapshot] = await Promise.all([
      loadPlan(),
      firestore.collection("kitchens").doc(kitchenId).collection("daily_expenses").doc(serviceDate).get(),
      firestore.collection("kitchens").doc(kitchenId).collection("daily_expenses")
        .where("service_date", ">=", monthStart).where("service_date", "<=", serviceDate).get(),
    ]);
    const expenses = normalizeDailyExpenses(daySnapshot.data()?.amounts);
    const monthToDateExpense = monthSnapshot.docs.reduce((total, document) => total + dailyExpenseTotal(normalizeDailyExpenses(document.get("amounts"))), 0);

    return NextResponse.json({
      plan,
      monthlyPayrollInr: monthlyPayroll(plan),
      dailyExpense: { serviceDate, amounts: expenses, totalInr: dailyExpenseTotal(expenses), notes: String(daySnapshot.get("notes") || "") },
      monthToDateExpenseInr: monthToDateExpense,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const staff = await verifyStaffRole(request, "admin");
    const body = await request.json() as Record<string, unknown>;
    const kitchenId = typeof body.kitchenId === "string" ? body.kitchenId : "";
    const serviceDate = typeof body.serviceDate === "string" ? body.serviceDate : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
    if (!validKitchen(kitchenId) || !validDate(serviceDate)) return NextResponse.json({ error: "Valid kitchen and service date are required." }, { status: 400 });

    const amounts = normalizeDailyExpenses(body.amounts);
    await firestoreClient().collection("kitchens").doc(kitchenId).collection("daily_expenses").doc(serviceDate).set({
      kitchen_id: kitchenId,
      service_date: serviceDate,
      amounts,
      total_inr: dailyExpenseTotal(amounts),
      notes,
      updated_by: staff.uid,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    await writeAuditLog(staff.uid, "operations.daily_expense_upsert", "kitchen", kitchenId, { serviceDate, totalInr: dailyExpenseTotal(amounts) });
    return NextResponse.json({ saved: true, totalInr: dailyExpenseTotal(amounts) });
  } catch (error) { return failure(error); }
}
