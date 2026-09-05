import { CITY_BY_CODE, cityFromAddress, resolveSchoolZone, ZONE_BY_CODE } from "@/lib/school-locator/territories";
import { fetchProviderJson } from "@/lib/school-locator/provider-utils";
import { normalizeSchoolCandidate } from "@/lib/school-locator/normalization";
import type { ProviderSearchParams, SchoolSearchProvider, SchoolSearchResult } from "@/lib/school-locator/types";

type SerpPlace = {
  title?: string; address?: string; type?: string; types?: string[]; place_id?: string; data_id?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

function normalizePlace(place: SerpPlace, params: Pick<ProviderSearchParams, "cityCode" | "zoneCode">) {
  return normalizeSchoolCandidate({
    name: place.title || "",
    address: place.address || "",
    locality: null,
    subLocality: null,
    postalCode: place.address?.match(/\b\d{6}\b/)?.[0] || null,
    latitude: Number(place.gps_coordinates?.latitude),
    longitude: Number(place.gps_coordinates?.longitude),
    provider: "serpapi",
    providerPlaceId: place.place_id || place.data_id || null,
    types: [place.type || "", ...(place.types || [])].filter(Boolean),
    selectedCityCode: params.cityCode,
    selectedZoneCode: params.zoneCode,
    confidence: 0.82,
  });
}

export class SerpApiGoogleMapsProvider implements SchoolSearchProvider {
  readonly name = "serpapi" as const;

  private apiKey() {
    const key = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
    if (!key) throw new Error("SerpAPI is not configured.");
    return key;
  }

  async searchSchools(params: ProviderSearchParams) {
    const locality = params.cityWide ? params.cityName : params.zoneName;
    const query = `${params.query} private school ${locality} ${params.cityName} Tamil Nadu`;
    const search = new URLSearchParams({ engine: "google_maps", type: "search", q: query, hl: "en", gl: "in", api_key: this.apiKey() });
    const payload = await fetchProviderJson(`https://serpapi.com/search.json?${search}`, {}, this.name, 4500) as { local_results?: SerpPlace[]; error?: string };
    if (payload.error) throw new Error("SerpAPI search failed.");
    return (payload.local_results || []).slice(0, params.limit).map((place) => normalizePlace(place, params)).filter((school): school is SchoolSearchResult => Boolean(school));
  }

  async getSchoolDetails(id: string) {
    const search = new URLSearchParams({ engine: "google_maps", type: "place", data_id: id, hl: "en", gl: "in", api_key: this.apiKey() });
    const payload = await fetchProviderJson(`https://serpapi.com/search.json?${search}`, {}, this.name, 4500) as { place_results?: SerpPlace };
    const place = payload.place_results;
    if (!place) return null;
    const city = cityFromAddress(place.address || "");
    if (!city) return null;
    const resolved = resolveSchoolZone({ cityCode: city.code, address: place.address });
    const zone = resolved ? ZONE_BY_CODE.get(resolved.zoneCode) : CITY_BY_CODE.get(city.code)?.zones[0] && ZONE_BY_CODE.get(CITY_BY_CODE.get(city.code)!.zones[0].code);
    return zone ? normalizePlace(place, { cityCode: city.code, zoneCode: zone.code }) : null;
  }
}
