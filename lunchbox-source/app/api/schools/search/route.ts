import { NextResponse } from "next/server";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";
import { logError, requestId } from "@/lib/logging";
import { privateSchoolLocatorAgent } from "@/lib/school-locator";
import { SchoolSearchValidationError } from "@/lib/school-locator/private-school-locator-agent";
import { CITY_BY_CODE, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const correlationId = requestId(request);
  try {
    const url = new URL(request.url);
    const cityCode = (url.searchParams.get("city") || "").toUpperCase() as CityCode;
    const zoneCode = (url.searchParams.get("zone") || "").toUpperCase() as ZoneCode;
    const query = (url.searchParams.get("q") || "").trim();
    const city = CITY_BY_CODE.get(cityCode);
    const zone = ZONE_BY_CODE.get(zoneCode);
    if (query.length < 3) return NextResponse.json({ error: "Enter at least three characters of the school name." }, { status: 400 });
    if (!city || !zone || zone.city.code !== city.code) return NextResponse.json({ error: "Choose a supported city and zone." }, { status: 400 });
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit("private_school_locator", forwardedFor, 30, 60);
    const response = await privateSchoolLocatorAgent.search({
      cityCode, zoneCode, query,
      limit: Number(url.searchParams.get("limit") || 10),
      cityWide: url.searchParams.get("scope") === "city",
    });
    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": correlationId } });
  } catch (error) {
    const status = error instanceof SchoolSearchValidationError ? 400 : error instanceof RateLimitError ? 429 : 503;
    if (status === 503) logError("school_search_failed", error, { correlationId });
    const message = status === 503 ? "School search is temporarily unavailable. You can enter the school manually." : error instanceof Error ? error.message : "Unable to search schools.";
    return NextResponse.json({ error: message, correlationId }, { status });
  }
}
