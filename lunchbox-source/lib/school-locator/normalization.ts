import { createHash } from "node:crypto";
import { CITY_BY_CODE, cityFromAddress, normalizeLocationText, resolveSchoolZone, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";
import type { PrivateStatus, SchoolProvider, SchoolSearchResult } from "@/lib/school-locator/types";

const SCHOOL_TERMS = /\b(school|vidyalaya|vidhyalaya|vidya mandir|matric|matriculation|higher secondary|senior secondary|international|public school|convent|montessori|academy)\b/i;
const EXCLUDED_TERMS = /\b(college|university|coaching|tuition|driving school|dance school|music school|training institute|government office)\b/i;
const GOVERNMENT_TERMS = /\b(government|govt|corporation school|municipal school|panchayat union|kendriya vidyalaya|jawahar navodaya)\b/i;

export function normalizeSchoolName(value: string) { return normalizeLocationText(value); }

export function isLikelyPrivateSchool(name: string, types: readonly string[] = []) {
  const text = `${name} ${types.join(" ")}`;
  if (EXCLUDED_TERMS.test(text) || GOVERNMENT_TERMS.test(text)) return false;
  return SCHOOL_TERMS.test(text) || types.some((type) => type === "school" || type === "secondary_school");
}

export function inferPrivateStatus(name: string, types: readonly string[] = []): PrivateStatus {
  const text = `${name} ${types.join(" ")}`;
  if (/\b(private school|matriculation|international school|convent)\b/i.test(text)) return "likely";
  return "unverified";
}

export function buildSearchKeywords(name: string) {
  const normalized = normalizeSchoolName(name);
  const words = normalized.split(" ").filter((word) => word.length >= 3);
  const keywords = new Set<string>();
  for (const word of words.slice(0, 8)) {
    keywords.add(word);
    for (let length = 3; length <= Math.min(word.length, 8); length += 1) keywords.add(word.slice(0, length));
  }
  for (let length = 3; length <= Math.min(normalized.length, 12); length += 1) keywords.add(normalized.slice(0, length));
  return [...keywords].slice(0, 40);
}

export type SchoolCandidate = {
  name: string;
  address: string;
  locality?: string | null;
  subLocality?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  provider: SchoolProvider;
  providerPlaceId?: string | null;
  types?: readonly string[];
  selectedCityCode: CityCode;
  selectedZoneCode: ZoneCode;
  confidence?: number;
};

export function normalizeSchoolCandidate(candidate: SchoolCandidate): SchoolSearchResult | null {
  const name = candidate.name.trim().slice(0, 160);
  const address = candidate.address.trim().slice(0, 300);
  if (name.length < 3 || address.length < 3 || !isLikelyPrivateSchool(name, candidate.types)) return null;
  if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) return null;

  const detectedCity = cityFromAddress(`${candidate.locality || ""} ${candidate.subLocality || ""} ${address}`);
  if (detectedCity && detectedCity.code !== candidate.selectedCityCode) return null;
  const city = CITY_BY_CODE.get(candidate.selectedCityCode);
  const selectedZone = ZONE_BY_CODE.get(candidate.selectedZoneCode);
  if (!city || !selectedZone || selectedZone.city.code !== city.code) return null;
  const resolved = resolveSchoolZone({ cityCode: city.code, locality: candidate.locality, subLocality: candidate.subLocality, address });
  const zone = resolved ? ZONE_BY_CODE.get(resolved.zoneCode) : selectedZone;
  if (!zone) return null;
  const normalizedName = normalizeSchoolName(name);
  const stableKey = candidate.providerPlaceId || `${normalizedName}:${normalizeLocationText(address)}`;
  const id = candidate.provider === "google" && candidate.providerPlaceId
    ? `GOOGLE-${createHash("sha256").update(candidate.providerPlaceId).digest("hex").slice(0, 20).toUpperCase()}`
    : `SCHOOL-${createHash("sha256").update(stableKey).digest("hex").slice(0, 20).toUpperCase()}`;

  return {
    id,
    school_name: name,
    normalized_name: normalizedName,
    formatted_address: address,
    locality: (candidate.locality || resolved?.locality || zone.name).slice(0, 100),
    sub_locality: candidate.subLocality?.slice(0, 100) || null,
    zone_code: zone.code,
    zone_name: zone.name,
    city_code: city.code,
    city_name: city.name,
    state: "Tamil Nadu",
    postal_code: candidate.postalCode?.match(/\b\d{6}\b/)?.[0] || address.match(/\b\d{6}\b/)?.[0] || null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    provider: candidate.provider,
    provider_place_id: candidate.providerPlaceId || null,
    school_type: candidate.types?.find((type) => /school|secondary|academy/i.test(type)) || "school",
    school_board: null,
    private_status: inferPrivateStatus(name, candidate.types),
    confidence: Math.max(0, Math.min(1, candidate.confidence ?? (resolved ? 0.9 : 0.72))),
    is_active: true,
    search_keywords: buildSearchKeywords(name),
    outside_selected_zone: !resolved || zone.code !== candidate.selectedZoneCode,
    zone_resolution: resolved ? "locality" : "search_context",
    board: null, classes_from: null, classes_to: null, student_strength_total: null, student_strength_6_12: null,
    website: null, phone: null, email: null, principal_name: null, school_management_type: null,
    estimated_lunch_students: null, franchise_id: null, territory_id: null, territory_manager: null,
  };
}

function distanceMetres(left: SchoolSearchResult, right: SchoolSearchResult) {
  if (left.latitude === null || left.longitude === null || right.latitude === null || right.longitude === null) return Number.POSITIVE_INFINITY;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(right.latitude - left.latitude);
  const dLon = radians(right.longitude - left.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function deduplicateSchools(schools: SchoolSearchResult[]) {
  const unique: SchoolSearchResult[] = [];
  for (const school of schools) {
    const duplicateIndex = unique.findIndex((existing) =>
      Boolean(school.provider_place_id && existing.provider_place_id === school.provider_place_id)
      || (existing.normalized_name === school.normalized_name && Boolean(school.postal_code && existing.postal_code === school.postal_code))
      || (existing.normalized_name === school.normalized_name && normalizeLocationText(existing.formatted_address) === normalizeLocationText(school.formatted_address))
      || (existing.normalized_name === school.normalized_name && distanceMetres(existing, school) <= 120));
    if (duplicateIndex < 0) unique.push(school);
    else if (school.confidence > unique[duplicateIndex].confidence) unique[duplicateIndex] = school;
  }
  return unique;
}

export function rankSchools(schools: SchoolSearchResult[], query: string, zoneCode: ZoneCode) {
  const normalizedQuery = normalizeSchoolName(query);
  const score = (school: SchoolSearchResult) => {
    let points = 0;
    if (school.normalized_name.startsWith(normalizedQuery)) points += 100;
    else if (school.normalized_name.includes(normalizedQuery)) points += 55;
    if (school.zone_code === zoneCode) points += 30;
    if (normalizeLocationText(school.locality).includes(normalizedQuery)) points += 5;
    if (school.school_type && /school|secondary/i.test(school.school_type)) points += 10;
    if (school.provider === "google") points += 5;
    return points + school.confidence * 10;
  };
  return [...schools].sort((left, right) => score(right) - score(left) || left.school_name.localeCompare(right.school_name));
}
