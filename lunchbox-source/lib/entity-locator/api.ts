import { createHash } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { entityAnalytics, entityDirectory } from "@/lib/entity-locator";
import { buildEntitySearchKeywords, normalizeEntityName } from "@/lib/entity-locator/normalization";
import { ENTITY_PROFILES } from "@/lib/entity-locator/profiles";
import type { EntityType, LocationEntityResult } from "@/lib/entity-locator/types";
import { firestoreClient } from "@/lib/firestore";
import { validateMealEnrollment } from "@/lib/meal-enrollment";
import { CITY_BY_CODE, ZONE_BY_CODE, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";

function text(body: Record<string, unknown>, key: string, max: number) { return typeof body[key] === "string" ? body[key].trim().slice(0, max) : ""; }

export function createManualEntity(entityType: EntityType, body: Record<string, unknown>): { entity?: LocationEntityResult; error?: string } {
  const name = text(body, "display_name", 160);
  const address = text(body, "formatted_address", 300);
  const locality = text(body, "locality", 100);
  const postalCode = text(body, "postal_code", 6);
  const cityCode = text(body, "city_code", 20).toUpperCase() as CityCode;
  const zoneCode = text(body, "zone_code", 40).toUpperCase() as ZoneCode;
  const city = CITY_BY_CODE.get(cityCode); const zone = ZONE_BY_CODE.get(zoneCode);
  if (name.length < 3 || address.length < 5 || locality.length < 2 || !/^\d{6}$/.test(postalCode) || !city || !zone || zone.city.code !== city.code) {
    return { error: `Enter a valid ${entityType} name, address, locality, city, zone and six-digit pincode.` };
  }
  const normalizedName = normalizeEntityName(name);
  const profile = ENTITY_PROFILES[entityType];
  const id = `MANUAL-${profile.idPrefix}-${createHash("sha256").update(`${cityCode}:${zoneCode}:${normalizedName}:${postalCode}`).digest("hex").slice(0, 20).toUpperCase()}`;
  return { entity: {
    id, entity_type: entityType, display_name: name, normalized_name: normalizedName, formatted_address: address,
    locality, sub_locality: null, zone_code: zoneCode, zone_name: zone.name, city_code: cityCode, city_name: city.name,
    state: "Tamil Nadu", postal_code: postalCode, latitude: null, longitude: null, provider: "manual",
    provider_place_id: null, category: null, verification_status: "unverified", confidence: 0.5, is_active: true,
    search_keywords: buildEntitySearchKeywords(name), zone_resolution: "locality", company_id: null, legal_name: null,
    company_type: null, industry: null, primary_office_id: null, website: null, phone: null, email: null, gstin: null, cin: null,
    employee_strength: null, student_strength: null,
  } };
}

export type RegistrationResult = { referenceId?: string; status?: "RECEIVED"; error?: string };
export function registrationEntityFields(entity: LocationEntityResult) {
  return {
    [`${entity.entity_type}_id`]: entity.id,
    display_name: entity.display_name,
    formatted_address: entity.formatted_address,
    locality: entity.locality,
    city_code: entity.city_code,
    zone_code: entity.zone_code,
    latitude: entity.latitude,
    longitude: entity.longitude,
    provider: entity.provider,
    source_place_id: entity.provider_place_id,
  };
}
export async function registerIndividualMealEnrollment(entityType: EntityType, body: Record<string, unknown>, defer: (task: () => Promise<void>) => void = (task) => queueMicrotask(() => void task().catch(() => undefined))): Promise<RegistrationResult> {
  const entityId = text(body, `${entityType}_id`, 100);
  if (!/^[A-Z0-9-]{8,100}$/i.test(entityId)) return { error: `Select a valid ${entityType} before registering.` };
  const entity = await entityDirectory.getById(entityType, entityId);
  if (!entity || !entity.is_active) return { error: `The selected ${entityType} is unavailable.` };
  const profile = entityType === "college" ? "college_student" : "office_worker";
  const intake = validateMealEnrollment(body, profile);
  if (!intake.data) return { error: intake.error };
  const prefix = entityType === "college" ? "COL" : "EMP";
  const referenceId = `${prefix}-${createHash("sha256").update(`${entity.id}:${intake.data.contactPhone}:${Date.now()}`).digest("hex").slice(0, 10).toUpperCase()}`;
  await firestoreClient().collection("meal_enrollment_requests").doc(referenceId).set({
    registration_id: referenceId, ...registrationEntityFields(entity),
    registration_type: entityType === "college" ? "COLLEGE_STUDENT" : "OFFICE_WORKER",
    location_entity_type: entityType,
    person_name: intake.data.personName,
    contact_phone: intake.data.contactPhone,
    contact_email: intake.data.contactEmail,
    ...intake.data.fields,
    consent_at: FieldValue.serverTimestamp(), status: "RECEIVED", registration_source: "public_form",
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  });
  defer(async () => { await entityAnalytics.recordRegistration(entity, entity.provider).catch(() => undefined); });
  return { referenceId, status: "RECEIVED" };
}
