import { NextRequest, NextResponse } from "next/server";
import type { MarketingLead } from "@/lib/marketing";
import { saveMarketingLocation } from "@/lib/marketing-gcp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { lead?: MarketingLead; schoolPlaceId?: string } | null;
  if (!body?.lead?.id || !body.lead.name || !body.lead.address) {
    return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
  }
  try {
    const mode = await saveMarketingLocation(body.lead, body.schoolPlaceId);
    return NextResponse.json({ saved: true, mode });
  } catch {
    return NextResponse.json({ error: "The location could not be saved to BigQuery." }, { status: 502 });
  }
}
