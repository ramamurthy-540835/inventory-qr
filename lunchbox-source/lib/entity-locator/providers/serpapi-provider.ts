import { ENTITY_PROFILES } from "@/lib/entity-locator/profiles";
import { normalizeEntityCandidate } from "@/lib/entity-locator/normalization";
import type { EntityProviderSearchParams, LocationEntityResult, LocationEntitySearchProvider } from "@/lib/entity-locator/types";
import { fetchProviderJson } from "@/lib/school-locator/provider-utils";

type SerpPlace = { title?: string; address?: string; type?: string; types?: string[]; place_id?: string; data_id?: string; gps_coordinates?: { latitude?: number; longitude?: number } };

export class SerpApiLocationEntityProvider implements LocationEntitySearchProvider {
  readonly name = "serpapi" as const;

  private apiKey() {
    const key = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
    if (!key) throw new Error("SerpAPI is not configured.");
    return key;
  }

  async search(params: EntityProviderSearchParams) {
    const profile = ENTITY_PROFILES[params.entityType];
    const location = params.cityWide ? params.cityName : params.zoneName;
    const query = `${params.query} ${profile.serpQueryTerms[0]} ${location} ${params.cityName} Tamil Nadu`;
    const search = new URLSearchParams({ engine: "google_maps", type: "search", q: query, hl: "en", gl: "in", api_key: this.apiKey() });
    const payload = await fetchProviderJson(`https://serpapi.com/search.json?${search}`, {}, this.name, 4500) as { local_results?: SerpPlace[]; error?: string };
    if (payload.error) throw new Error("SerpAPI search failed.");
    return (payload.local_results || []).slice(0, params.limit).map((place) => normalizeEntityCandidate({
      entityType: params.entityType, name: place.title || "", address: place.address || "", locality: null,
      postalCode: place.address?.match(/\b\d{6}\b/)?.[0] || null, latitude: Number(place.gps_coordinates?.latitude),
      longitude: Number(place.gps_coordinates?.longitude), provider: "serpapi", providerPlaceId: place.place_id || place.data_id || null,
      types: [place.type || "", ...(place.types || [])].filter(Boolean), selectedCityCode: params.cityCode,
      selectedZoneCode: params.zoneCode, confidence: 0.82,
    })).filter((entity): entity is LocationEntityResult => Boolean(entity));
  }
}
