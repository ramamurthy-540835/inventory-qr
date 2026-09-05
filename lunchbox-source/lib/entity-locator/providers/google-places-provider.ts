import { ENTITY_PROFILES } from "@/lib/entity-locator/profiles";
import { normalizeEntityCandidate } from "@/lib/entity-locator/normalization";
import type { EntityProviderSearchParams, LocationEntityResult, LocationEntitySearchProvider } from "@/lib/entity-locator/types";
import { fetchProviderJson } from "@/lib/school-locator/provider-utils";
import { CITY_BY_CODE } from "@/lib/school-locator/territories";

type AddressComponent = { longText?: string; types?: string[] };
type GooglePlace = { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; types?: string[]; addressComponents?: AddressComponent[] };
const GOOGLE_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents";

function component(place: GooglePlace, type: string) {
  return place.addressComponents?.find((item) => item.types?.includes(type))?.longText || null;
}

export class GoogleLocationEntityProvider implements LocationEntitySearchProvider {
  readonly name = "google" as const;

  private apiKey() {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("Google Places is not configured.");
    return key;
  }

  async search(params: EntityProviderSearchParams) {
    const city = CITY_BY_CODE.get(params.cityCode);
    if (!city) return [];
    const profile = ENTITY_PROFILES[params.entityType];
    const location = params.cityWide ? params.cityName : params.zoneName;
    const payload = await fetchProviderJson("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey(), "X-Goog-FieldMask": GOOGLE_FIELDS },
      body: JSON.stringify({
        textQuery: `${params.query} ${profile.googleQueryTerm} ${location} ${params.cityName} Tamil Nadu`,
        languageCode: "en", regionCode: "IN", maxResultCount: Math.min(params.limit, 10),
        locationBias: { circle: { center: { latitude: city.latitude, longitude: city.longitude }, radius: 30000 } },
      }),
    }, this.name, 2800) as { places?: GooglePlace[] };
    return (payload.places || []).map((place) => normalizeEntityCandidate({
      entityType: params.entityType, name: place.displayName?.text || "", address: place.formattedAddress || "",
      locality: component(place, "sublocality_level_1") || component(place, "locality"),
      subLocality: component(place, "sublocality_level_2") || component(place, "neighborhood"),
      postalCode: component(place, "postal_code"), latitude: Number(place.location?.latitude),
      longitude: Number(place.location?.longitude), provider: "google", providerPlaceId: place.id || null,
      types: place.types || [], selectedCityCode: params.cityCode, selectedZoneCode: params.zoneCode, confidence: 0.95,
    })).filter((entity): entity is LocationEntityResult => Boolean(entity));
  }
}
