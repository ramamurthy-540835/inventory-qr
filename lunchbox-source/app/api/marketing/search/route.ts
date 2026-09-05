import { NextRequest, NextResponse } from "next/server";
import {
  audienceTypes, cityCenters, marketingCities, marketingGeography,
  type AudienceType, type MarketingCity, type MarketingLead,
} from "@/lib/marketing";

export const runtime = "nodejs";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
};

const allowedPlaceTypes: Partial<Record<AudienceType, ReadonlySet<string>>> = {
  schools: new Set(["school", "primary_school", "secondary_school", "preschool"]),
  colleges: new Set(["university", "college"]),
};

function isAllowedPlace(place: GooglePlace, audience: AudienceType) {
  const allowedTypes = allowedPlaceTypes[audience];
  if (!allowedTypes) return true;
  const types = new Set([place.primaryType, ...(place.types || [])].filter((type): type is string => Boolean(type)));
  return [...allowedTypes].some((type) => types.has(type));
}

function normalize(value?: string) {
  return (value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distanceMetres(left: GooglePlace, right: GooglePlace) {
  const leftLat = left.location?.latitude; const leftLng = left.location?.longitude;
  const rightLat = right.location?.latitude; const rightLng = right.location?.longitude;
  if (leftLat == null || leftLng == null || rightLat == null || rightLng == null) return Number.POSITIVE_INFINITY;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDistance = radians(rightLat - leftLat); const lngDistance = radians(rightLng - leftLng);
  const a = Math.sin(latDistance / 2) ** 2 + Math.cos(radians(leftLat)) * Math.cos(radians(rightLat)) * Math.sin(lngDistance / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function uniquePlaces(places: GooglePlace[]) {
  const unique: GooglePlace[] = [];
  const placeIds = new Set<string>();
  const exactListings = new Set<string>();
  for (const place of places) {
    if (place.id && placeIds.has(place.id)) continue;
    const name = normalize(place.displayName?.text);
    const address = normalize(place.formattedAddress);
    const listingKey = `${name}|${address}`;
    if (exactListings.has(listingKey)) continue;
    const nearbyDuplicate = unique.some((candidate) => normalize(candidate.displayName?.text) === name && distanceMetres(candidate, place) <= 200);
    if (nearbyDuplicate) continue;
    if (place.id) placeIds.add(place.id);
    exactListings.add(listingKey);
    unique.push(place);
  }
  return unique;
}

function isCity(value: string): value is MarketingCity {
  return marketingCities.includes(value as MarketingCity);
}
function isAudience(value: string): value is AudienceType { return value in audienceTypes; }

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY is not configured on the server." }, { status: 503 });
  const city = request.nextUrl.searchParams.get("city")?.trim() || "";
  const zone = request.nextUrl.searchParams.get("zone")?.trim() || "";
  const area = request.nextUrl.searchParams.get("area")?.trim() || "";
  const audience = request.nextUrl.searchParams.get("audience")?.trim() || "";
  const keyword = request.nextUrl.searchParams.get("keyword")?.trim().slice(0, 80) || "";
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
  if (!isCity(city) || !isAudience(audience)) return NextResponse.json({ error: "Choose a supported city and audience." }, { status: 400 });
  const zones = marketingGeography[city] as Record<string, readonly string[]>;
  if (!zone || !zones[zone] || !area || !zones[zone].includes(area)) {
    return NextResponse.json({ error: "Choose a valid zone and area for the selected city." }, { status: 400 });
  }
  const query = `${keyword || audienceTypes[audience].searchTerm} in ${area}, ${city}, Tamil Nadu`;
  const center = cityCenters[city];
  try {
    const places: GooglePlace[] = [];
    let pageToken: string | undefined;
    do {
      const pageSize = Math.min(20, limit - places.length);
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryType,places.primaryTypeDisplayName,places.types,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: query, pageSize, pageToken, languageCode: "en", regionCode: "IN",
          locationBias: { circle: { center, radius: 25_000 } },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json() as { places?: GooglePlace[]; nextPageToken?: string; error?: { message?: string } };
      if (!response.ok) return NextResponse.json({ error: data.error?.message || "Google Places search failed." }, { status: response.status });
      places.push(...(data.places || []));
      pageToken = data.nextPageToken;
    } while (places.length < limit && pageToken);

    const filteredPlaces = uniquePlaces(places.filter((place) => isAllowedPlace(place, audience)));
    const leads: MarketingLead[] = filteredPlaces.slice(0, limit).flatMap((place, index) => {
      if (!place.displayName?.text) return [];
      return [{
        id: place.id || `${city}-${area}-${audience}-${index}`, placeId: place.id,
        name: place.displayName.text, type: place.primaryTypeDisplayName?.text || audienceTypes[audience].label,
        address: place.formattedAddress || `${area}, ${city}`, phone: place.nationalPhoneNumber,
        website: place.websiteUri, mapsUrl: place.googleMapsUri, rating: place.rating,
        reviews: place.userRatingCount, city, zone, area, audience, position: index + 1,
        latitude: place.location?.latitude, longitude: place.location?.longitude,
      }];
    });
    return NextResponse.json({ query, leads, limit, filteredCount: places.length - filteredPlaces.length, provider: "Google Places API (New)", fetchedAt: new Date().toISOString() });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timedOut ? "Google Places search timed out." : "Discovery is temporarily unavailable." }, { status: 502 });
  }
}
