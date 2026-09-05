import { NextResponse } from "next/server";
import { getFranchises } from "@/lib/franchises";
import { logError, requestId } from "@/lib/logging";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const correlationId = requestId(request);
  try {
    const url = new URL(request.url);
    return NextResponse.json(await getFranchises({ area: url.searchParams.get("area") || undefined, category: url.searchParams.get("category") || undefined, search: url.searchParams.get("search") || undefined, limit: Number(url.searchParams.get("limit") || 1000) }));
  } catch (error) {
    logError("franchises.load_failed", error, { correlationId });
    return NextResponse.json({ error: "Unable to load franchise details.", correlationId }, { status: 500, headers: { "X-Request-Id": correlationId } });
  }
}
