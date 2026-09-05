import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";
import { logInfo } from "@/lib/logging";
import { schoolAnalytics, schoolDirectory } from "@/lib/school-locator";
import { buildSearchKeywords, normalizeSchoolName } from "@/lib/school-locator/normalization";
import { CITY_BY_CODE, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";
import type { SchoolSearchResult } from "@/lib/school-locator/types";

export const runtime = "nodejs";

function value(body: Record<string, unknown>, key: string, max: number) { return typeof body[key] === "string" ? body[key].trim().slice(0, max) : ""; }

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit("manual_school", forwardedFor, 5, 3600);
    const body = await request.json() as Record<string, unknown>;
    const schoolName = value(body, "school_name", 160);
    const address = value(body, "formatted_address", 300);
    const locality = value(body, "locality", 100);
    const postalCode = value(body, "postal_code", 6);
    const cityCode = value(body, "city_code", 20).toUpperCase() as CityCode;
    const zoneCode = value(body, "zone_code", 40).toUpperCase() as ZoneCode;
    const city = CITY_BY_CODE.get(cityCode);
    const zone = ZONE_BY_CODE.get(zoneCode);
    if (schoolName.length < 3 || address.length < 5 || locality.length < 2 || !/^\d{6}$/.test(postalCode) || !city || !zone || zone.city.code !== city.code) {
      return NextResponse.json({ error: "Enter a valid school name, address, locality, city, zone and six-digit pincode." }, { status: 400 });
    }
    const normalizedName = normalizeSchoolName(schoolName);
    const id = `MANUAL-${createHash("sha256").update(`${cityCode}:${zoneCode}:${normalizedName}:${postalCode}`).digest("hex").slice(0, 20).toUpperCase()}`;
    const school: SchoolSearchResult = {
      id, school_name: schoolName, normalized_name: normalizedName, formatted_address: address,
      locality, sub_locality: null, zone_code: zoneCode, zone_name: zone.name,
      city_code: cityCode, city_name: city.name, state: "Tamil Nadu", postal_code: postalCode,
      latitude: null, longitude: null, provider: "manual", provider_place_id: null,
      school_type: null, school_board: null, private_status: "unverified", confidence: 0.5,
      is_active: true, search_keywords: buildSearchKeywords(schoolName), zone_resolution: "locality",
      board: null, classes_from: null, classes_to: null, student_strength_total: null, student_strength_6_12: null,
      website: null, phone: null, email: null, principal_name: null, school_management_type: null,
      estimated_lunch_students: null, franchise_id: null, territory_id: null, territory_manager: null,
    };
    await schoolDirectory.saveManual(school);
    after(async () => { await schoolAnalytics.recordSchools([school]).catch(() => undefined); });
    logInfo("school_manual_created", { city: cityCode, zone: zoneCode });
    return NextResponse.json({ school }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RateLimitError ? error.message : "Unable to add this school manually." }, { status: error instanceof RateLimitError ? 429 : 500 });
  }
}
