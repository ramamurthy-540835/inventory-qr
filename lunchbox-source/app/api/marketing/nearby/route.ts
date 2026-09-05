import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { MarketingLead } from "@/lib/marketing";
import { recordDiscovery } from "@/lib/marketing-gcp";

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
  primaryTypeDisplayName?: { text?: string };
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY is not configured on the server." }, { status: 503 });

  const body = await request.json().catch(() => null) as { school?: MarketingLead; radiusKm?: number } | null;
  const school = body?.school;
  const radiusKm = Math.min(10, Math.max(1, Number(body?.radiusKm) || 5));
  if (!school || typeof school.latitude !== "number" || typeof school.longitude !== "number") {
    return NextResponse.json({ error: "Select a school with valid map coordinates." }, { status: 400 });
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({
        textQuery: `apartment complexes and gated communities near ${school.name}, ${school.area || school.city}, Tamil Nadu`,
        pageSize: 20,
        locationBias: { circle: { center: { latitude: school.latitude, longitude: school.longitude }, radius: radiusKm * 1000 } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json() as { places?: GooglePlace[]; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Google Places search failed." }, { status: response.status });

    const communities: MarketingLead[] = (data.places || []).flatMap((place, index) => {
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;
      if (!place.displayName?.text || typeof latitude !== "number" || typeof longitude !== "number") return [];
      const distance = distanceKm(school.latitude!, school.longitude!, latitude, longitude);
      if (distance > radiusKm * 1.25) return [];
      return [{
        id: place.id || `${latitude}-${longitude}`,
        placeId: place.id,
        name: place.displayName.text,
        type: place.primaryTypeDisplayName?.text || "Apartment community",
        address: place.formattedAddress || school.city,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        mapsUrl: place.googleMapsUri,
        rating: place.rating,
        reviews: place.userRatingCount,
        city: school.city,
        zone: school.zone,
        area: school.area,
        audience: "apartments" as const,
        position: index + 1,
        latitude,
        longitude,
        distanceKm: Number(distance.toFixed(2)),
      }];
    }).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    const searchId = randomUUID();
    let persistence: "gcp" | "demo" | "failed" = "demo";
    try { persistence = await recordDiscovery({ searchId, school, radiusKm, communities }); } catch { persistence = "failed"; }
    return NextResponse.json({ searchId, school, radiusKm, communities, persistence, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timedOut ? "Google Places search timed out." : "Nearby search is temporarily unavailable." }, { status: 502 });
  }
}
