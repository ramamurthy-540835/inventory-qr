import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { logError, requestId } from "@/lib/logging";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const correlationId = requestId(request);
  try {
    return NextResponse.json(await getCatalog());
  } catch (error) {
    logError("catalog.load_failed", error, { correlationId });
    return NextResponse.json({ error: "Unable to load the current menu.", correlationId }, { status: 500, headers: { "X-Request-Id": correlationId } });
  }
}
