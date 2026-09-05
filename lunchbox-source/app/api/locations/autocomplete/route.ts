import { NextResponse } from "next/server";
import { privateSchoolLocatorAgent } from "@/lib/school-locator";
import { SchoolSearchValidationError } from "@/lib/school-locator/private-school-locator-agent";
import type { CityCode, ZoneCode } from "@/lib/school-locator/territories";

export const runtime = "nodejs";

const legacyCities: Record<string, CityCode> = {
  chennai: "CHENNAI", coimbatore: "COIMBATORE", trichy: "TRICHY", tiruchirappalli: "TRICHY", madurai: "MADURAI",
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cityValue = (url.searchParams.get("city") || "").toLowerCase();
    const cityCode = legacyCities[cityValue] || cityValue.toUpperCase() as CityCode;
    const zoneCode = (url.searchParams.get("zone") || "").toUpperCase() as ZoneCode;
    const response = await privateSchoolLocatorAgent.search({
      cityCode, zoneCode, query: url.searchParams.get("q") || "", limit: 10, cityWide: url.searchParams.get("scope") === "city",
    });
    return NextResponse.json({ suggestions: response.results, meta: response.meta }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof SchoolSearchValidationError ? 400 : 503;
    return NextResponse.json({ error: status === 503 ? "School search is temporarily unavailable." : error instanceof Error ? error.message : "Unable to search schools." }, { status });
  }
}
