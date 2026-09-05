import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyStaffRole } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { buildOperationsSummary, type OperationsOrder } from "@/lib/operations";

export const runtime = "nodejs";

const projectId = process.env.GCP_PROJECT_ID;
const datasetId = process.env.BIGQUERY_DATASET || "school_lunch";

async function subsidyCost(kitchenId: string, serviceDate: string) {
  if (!projectId || !/^[A-Za-z0-9_-]+$/.test(projectId) || !/^[A-Za-z0-9_-]+$/.test(datasetId)) return 0;
  try {
    const [rows] = await new BigQuery({ projectId }).query({
      query: `SELECT COALESCE(SUM(subsidy_cost_inr), 0) AS subsidy_cost FROM \`${projectId}.${datasetId}.free_meal_summary\` WHERE kitchen_id=@kitchenId AND service_month=DATE_TRUNC(DATE(@serviceDate), MONTH) AND service_date<=DATE(@serviceDate)`,
      params: { kitchenId, serviceDate },
      location: "asia-south1",
    });
    return Number(rows[0]?.subsidy_cost || 0);
  } catch (error) {
    throw new Error("BigQuery free_meal_summary is unavailable; apply infrastructure/bigquery.sql before using operations.", { cause: error });
  }
}

export async function GET(request: Request) {
  try {
    await verifyStaffRole(request, "admin");
    const url = new URL(request.url);
    const kitchenId = url.searchParams.get("kitchenId") || "";
    const serviceDate = url.searchParams.get("serviceDate") || "";
    if (!/^[a-z0-9-]{3,50}$/.test(kitchenId) || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return NextResponse.json({ error: "Valid kitchen and service date are required." }, { status: 400 });
    }

    const firestore = firestoreClient();
    const [kitchen, orderSnapshot, meetingSnapshot, subsidy] = await Promise.all([
      firestore.collection("kitchens").doc(kitchenId).get(),
      firestore.collection("orders").where("status", "==", "CONFIRMED").get(),
      firestore.collection("kitchens").doc(kitchenId).collection("school_meetings").get(),
      subsidyCost(kitchenId, serviceDate),
    ]);
    if (!kitchen.exists || kitchen.get("active") === false) return NextResponse.json({ error: "Kitchen was not found or is inactive." }, { status: 404 });

    const orders = orderSnapshot.docs.map((document) => document.data() as OperationsOrder);
    const summary = buildOperationsSummary(orders, kitchenId, serviceDate, {
      directCostPerMeal: kitchen.get("direct_cost_per_meal"),
      monthlyFixedCost: kitchen.get("monthly_fixed_cost"),
    }, subsidy);
    const upcomingMeetings = meetingSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() } as { id: string } & Record<string, unknown>))
      .filter((meeting) => meeting.active !== false && meeting.status !== "done" && String(meeting.date_time) >= new Date().toISOString())
      .sort((a, b) => String(a.date_time).localeCompare(String(b.date_time)))
      .slice(0, 10);

    return NextResponse.json({ ...summary, kitchenName: String(kitchen.get("kitchen_name") || kitchenId), upcomingMeetings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load franchise operations." }, { status: error instanceof ParentAuthError ? 403 : 500 });
  }
}
