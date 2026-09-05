import { NextResponse } from "next/server";
import { getFranchiseOpportunities } from "@/lib/franchise-opportunities";
import { logError, requestId } from "@/lib/logging";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const correlationId = requestId(request);
  try {
    return NextResponse.json(await getFranchiseOpportunities());
  } catch (error) {
    logError("franchise_opportunities.load_failed", error, { correlationId });
    return NextResponse.json({ error: "Unable to load franchise opportunities.", correlationId }, { status: 500 });
  }
}
