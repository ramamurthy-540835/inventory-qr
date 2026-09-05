import { createHash } from "node:crypto";
import { ENTITY_PROFILES } from "@/lib/entity-locator/profiles";
import type { EntityProvider, EntityType, LocationEntityResult } from "@/lib/entity-locator/types";
import { CITY_BY_CODE, cityFromAddress, normalizeLocationText, resolveSchoolZone, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";

export function normalizeEntityName(value: string) { return normalizeLocationText(value); }

export function buildEntitySearchKeywords(name: string) {
  const normalized = normalizeEntityName(name);
  const keywords = new Set<string>();
  for (const word of normalized.split(" ").filter((item) => item.length >= 3).slice(0, 8)) {
    keywords.add(word);
    for (let length = 3; length <= Math.min(word.length, 8); length += 1) keywords.add(word.slice(0, length));
  }
  for (let length = 3; length <= Math.min(normalized.length, 12); length += 1) keywords.add(normalized.slice(0, length));
  return [...keywords].slice(0, 40);
}

export function isRelevantEntity(entityType: EntityType, name: string, types: readonly string[] = []) {
  const profile = ENTITY_PROFILES[entityType];
  const text = `${name} ${types.join(" ").replaceAll("_", " ")}`;
  if (profile.excludePattern.test(text)) return false;
  if (profile.includePattern.test(text)) return true;
  // Google metadata is often sparse: retain plausible business results, but not generic places.
  return types.some((type) => profile.preferredTypes.includes(type)) || (name.trim().length >= 3 && types.some((type) => /establishment|point_of_interest/i.test(type)));
}

export type EntityCandidate = {
  entityType: EntityType;
  name: string;
  address: string;
  locality?: string | null;
  subLocality?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  provider: EntityProvider;
  providerPlaceId?: string | null;
  types?: readonly string[];
  selectedCityCode: CityCode;
  selectedZoneCode: ZoneCode;
  confidence?: number;
};

export function normalizeEntityCandidate(candidate: EntityCandidate): LocationEntityResult | null {
  const profile = ENTITY_PROFILES[candidate.entityType];
  const name = candidate.name.trim().slice(0, 160);
  const address = candidate.address.trim().slice(0, 300);
  if (name.length < 3 || address.length < 3 || !isRelevantEntity(candidate.entityType, name, candidate.types)) return null;
  if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) return null;
  const detectedCity = cityFromAddress(`${candidate.locality || ""} ${candidate.subLocality || ""} ${address}`);
  if (detectedCity && detectedCity.code !== candidate.selectedCityCode) return null;
  const city = CITY_BY_CODE.get(candidate.selectedCityCode);
  const selectedZone = ZONE_BY_CODE.get(candidate.selectedZoneCode);
  if (!city || !selectedZone || selectedZone.city.code !== city.code) return null;
  const resolved = resolveSchoolZone({ cityCode: city.code, locality: candidate.locality, subLocality: candidate.subLocality, address });
  const zone = resolved ? ZONE_BY_CODE.get(resolved.zoneCode) : selectedZone;
  if (!zone) return null;
  const normalizedName = normalizeEntityName(name);
  const stableKey = candidate.providerPlaceId || `${normalizedName}:${normalizeLocationText(address)}`;
  const id = `${profile.idPrefix}-${createHash("sha256").update(stableKey).digest("hex").slice(0, 20).toUpperCase()}`;
  const category = candidate.types?.find((type) => profile.preferredTypes.includes(type)) || candidate.types?.[0] || null;
  return {
    id, entity_type: candidate.entityType, display_name: name, normalized_name: normalizedName,
    formatted_address: address, locality: (candidate.locality || resolved?.locality || zone.name).slice(0, 100),
    sub_locality: candidate.subLocality?.slice(0, 100) || null, zone_code: zone.code, zone_name: zone.name,
    city_code: city.code, city_name: city.name, state: "Tamil Nadu",
    postal_code: candidate.postalCode?.match(/\b\d{6}\b/)?.[0] || address.match(/\b\d{6}\b/)?.[0] || null,
    latitude: candidate.latitude, longitude: candidate.longitude, provider: candidate.provider,
    provider_place_id: candidate.providerPlaceId || null, category,
    verification_status: candidate.provider === "manual" ? "unverified" : "likely",
    confidence: Math.max(0, Math.min(1, candidate.confidence ?? (resolved ? 0.9 : 0.72))), is_active: true,
    search_keywords: buildEntitySearchKeywords(name), outside_selected_zone: !resolved || zone.code !== candidate.selectedZoneCode,
    zone_resolution: resolved ? "locality" : "search_context", company_id: null, legal_name: null,
    company_type: null, industry: null, primary_office_id: null, website: null, phone: null, email: null,
    gstin: null, cin: null, employee_strength: null, student_strength: null,
  };
}

function distanceMetres(left: LocationEntityResult, right: LocationEntityResult) {
  if (left.latitude === null || left.longitude === null || right.latitude === null || right.longitude === null) return Infinity;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(right.latitude - left.latitude);
  const dLon = radians(right.longitude - left.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function deduplicateEntities(entities: LocationEntityResult[]) {
  const unique: LocationEntityResult[] = [];
  for (const entity of entities) {
    const duplicate = unique.findIndex((current) =>
      Boolean(entity.provider_place_id && current.provider_place_id === entity.provider_place_id)
      || (current.normalized_name === entity.normalized_name && Boolean(entity.postal_code && current.postal_code === entity.postal_code))
      || (current.normalized_name === entity.normalized_name && normalizeLocationText(current.formatted_address) === normalizeLocationText(entity.formatted_address))
      || (current.normalized_name === entity.normalized_name && distanceMetres(current, entity) <= 120));
    if (duplicate < 0) unique.push(entity);
    else if (entity.confidence > unique[duplicate].confidence) unique[duplicate] = entity;
  }
  return unique;
}

export function rankEntities(entities: LocationEntityResult[], query: string, zoneCode: ZoneCode) {
  const normalized = normalizeEntityName(query);
  return [...entities].sort((left, right) => {
    const score = (entity: LocationEntityResult) => {
      const profile = ENTITY_PROFILES[entity.entity_type];
      const preferredCategory = Boolean(entity.category && profile.preferredTypes.includes(entity.category));
      return (entity.normalized_name.startsWith(normalized) ? 100 : entity.normalized_name.includes(normalized) ? 55 : 0)
        + (entity.zone_code === zoneCode ? 30 : 0) + (preferredCategory ? 20 : entity.category ? -5 : 0)
        + (entity.provider === "google" ? 5 : 0) + entity.confidence * 10;
    };
    return score(right) - score(left) || left.display_name.localeCompare(right.display_name);
  });
}
