import { after, NextResponse } from "next/server";
import { logInfo, logWarning } from "@/lib/logging";
import { schoolAnalytics, schoolDirectory } from "@/lib/school-locator";
import { deduplicateSchools } from "@/lib/school-locator/normalization";
import { GooglePlacesProvider } from "@/lib/school-locator/providers/google-places-provider";
import { SerpApiGoogleMapsProvider } from "@/lib/school-locator/providers/serpapi-provider";
import { CITY_BY_CODE, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";
import type { SchoolSearchResult } from "@/lib/school-locator/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const categories = ["private school", "CBSE school", "matriculation school", "international school"] as const;

export async function POST(request: Request) {
  const expectedSecret = process.env.SCHOOL_DISCOVERY_TASK_SECRET;
  if (!expectedSecret || request.headers.get("X-Task-Secret") !== expectedSecret) return NextResponse.json({ error: "Unauthorized task request." }, { status: 401 });
  const body = await request.json() as { city?: string; zone?: string; maxLocalities?: number };
  const cityCode = String(body.city || "").toUpperCase() as CityCode;
  const zoneCode = String(body.zone || "").toUpperCase() as ZoneCode;
  const city = CITY_BY_CODE.get(cityCode);
  const zone = ZONE_BY_CODE.get(zoneCode);
  if (!city || !zone || zone.city.code !== city.code) return NextResponse.json({ error: "A valid city and zone are required." }, { status: 400 });
  const maxLocalities = Math.max(1, Math.min(Number(body.maxLocalities) || zone.localities.length, zone.localities.length));
  const google = new GooglePlacesProvider();
  const serpapi = new SerpApiGoogleMapsProvider();
  const discovered: SchoolSearchResult[] = [];
  let providerCalls = 0;

  for (const locality of zone.localities.slice(0, maxLocalities)) {
    for (const category of categories) {
      const params = {
        cityCode, zoneCode, query: `${category} ${locality}`, limit: 10, cityWide: false,
        cityName: city.name, zoneName: zone.name, localities: [locality],
      };
      try {
        const matches = await google.searchSchools(params);
        providerCalls += 1;
        discovered.push(...matches);
        if (matches.length < 5) {
          discovered.push(...await serpapi.searchSchools(params));
          providerCalls += 1;
        }
      } catch (error) {
        logWarning("school_preload_google_failed", { city: cityCode, zone: zoneCode, errorName: error instanceof Error ? error.name : "UnknownError" });
        try {
          discovered.push(...await serpapi.searchSchools(params));
          providerCalls += 1;
        } catch (fallbackError) {
          logWarning("school_preload_serpapi_failed", { city: cityCode, zone: zoneCode, errorName: fallbackError instanceof Error ? fallbackError.name : "UnknownError" });
        }
      }
    }
  }

  const schools = deduplicateSchools(discovered);
  await schoolDirectory.saveMany(schools);
  after(async () => { await schoolAnalytics.recordSchools(schools).catch(() => undefined); });
  logInfo("school_directory_synced", { city: cityCode, zone: zoneCode, result_count: schools.length, provider_calls: providerCalls });
  return NextResponse.json({ city: cityCode, zone: zoneCode, localitiesProcessed: maxLocalities, providerCalls, schoolsSaved: schools.length });
}
