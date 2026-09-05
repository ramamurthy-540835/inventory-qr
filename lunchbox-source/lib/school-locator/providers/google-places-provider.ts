import { CITY_BY_CODE, cityFromAddress, resolveSchoolZone, ZONE_BY_CODE } from "@/lib/school-locator/territories";
import { fetchProviderJson } from "@/lib/school-locator/provider-utils";
import { normalizeSchoolCandidate } from "@/lib/school-locator/normalization";
import type { ProviderSearchParams, SchoolSearchProvider, SchoolSearchResult } from "@/lib/school-locator/types";

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  addressComponents?: AddressComponent[];
};

const GOOGLE_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents";

function component(place: GooglePlace, type: string) {
  return place.addressComponents?.find((item) => item.types?.includes(type))?.longText || null;
}

function normalizePlace(place: GooglePlace, params: Pick<ProviderSearchParams, "cityCode" | "zoneCode">) {
  const latitude = Number(place.location?.latitude);
  const longitude = Number(place.location?.longitude);
  return normalizeSchoolCandidate({
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    locality: component(place, "sublocality_level_1") || component(place, "locality"),
    subLocality: component(place, "sublocality_level_2") || component(place, "neighborhood"),
    postalCode: component(place, "postal_code"),
    latitude,
    longitude,
    provider: "google",
    providerPlaceId: place.id || null,
    types: place.types || [],
    selectedCityCode: params.cityCode,
    selectedZoneCode: params.zoneCode,
    confidence: 0.95,
  });
}

export class GooglePlacesProvider implements SchoolSearchProvider {
  readonly name = "google" as const;

  private apiKey() {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("Google Places is not configured.");
    return key;
  }

  async searchSchools(params: ProviderSearchParams) {
    const city = CITY_BY_CODE.get(params.cityCode);
    if (!city) return [];
    const location = params.cityWide ? params.cityName : params.zoneName;
    const payload = await fetchProviderJson("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey(),
        "X-Goog-FieldMask": GOOGLE_FIELDS,
      },
      body: JSON.stringify({
        textQuery: `${params.query} private school ${location} ${params.cityName} Tamil Nadu`,
        includedType: "school",
        strictTypeFiltering: true,
        languageCode: "en",
        regionCode: "IN",
        maxResultCount: Math.min(params.limit, 10),
        locationBias: { circle: { center: { latitude: city.latitude, longitude: city.longitude }, radius: 30000 } },
      }),
    }, this.name, 2800) as { places?: GooglePlace[] };
    return (payload.places || []).map((place) => normalizePlace(place, params)).filter((school): school is SchoolSearchResult => Boolean(school));
  }

  async getSchoolDetails(id: string) {
    const placeId = id.replace(/^places\//, "");
    if (!placeId) return null;
    const payload = await fetchProviderJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": this.apiKey(), "X-Goog-FieldMask": GOOGLE_FIELDS.replaceAll("places.", "") },
    }, this.name, 2800) as GooglePlace;
    const city = cityFromAddress(payload.formattedAddress || "");
    if (!city) return null;
    const resolved = resolveSchoolZone({ cityCode: city.code, locality: component(payload, "sublocality_level_1"), address: payload.formattedAddress });
    const zone = resolved ? ZONE_BY_CODE.get(resolved.zoneCode) : city.zones[0] && ZONE_BY_CODE.get(city.zones[0].code);
    return zone ? normalizePlace(payload, { cityCode: city.code, zoneCode: zone.code }) : null;
  }
}
