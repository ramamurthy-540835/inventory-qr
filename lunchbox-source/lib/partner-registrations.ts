export const partnerRegistrationTypes = ["school", "office", "company", "college"] as const;
export type PartnerRegistrationType = typeof partnerRegistrationTypes[number];

export const partnerRegistrationStatuses = [
  "RECEIVED", "UNDER_REVIEW", "CONTACTED", "QUALIFIED", "PILOT_SCHEDULED", "ACTIVE", "REJECTED",
] as const;
export type PartnerRegistrationStatus = typeof partnerRegistrationStatuses[number];

export const registrationCollections: Record<PartnerRegistrationType, string> = {
  school: "school_onboarding_requests",
  office: "office_registrations",
  company: "company_registrations",
  college: "college_registrations",
};

export type PartnerRegistration = {
  registrationId: string;
  entityType: PartnerRegistrationType;
  entityId: string;
  displayName: string;
  formattedAddress: string;
  locality: string;
  cityCode: string;
  cityName: string;
  zoneCode: string;
  zoneName: string;
  status: PartnerRegistrationStatus;
  contactName: string | null;
  contactDesignation: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  strength: number | null;
  expectedLunchUsers: number | null;
  mealInterest: string | null;
  assignedTo: string | null;
  followUpAt: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  duplicateCount: number;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function nullableText(value: unknown) { return text(value) || null; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }

export function timestampIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof timestamp.toDate === "function") return timestamp.toDate().toISOString();
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  }
  return null;
}

export function normalizePartnerStatus(value: unknown): PartnerRegistrationStatus {
  const normalized = text(value).toUpperCase().replace(/[ -]+/g, "_");
  return partnerRegistrationStatuses.includes(normalized as PartnerRegistrationStatus)
    ? normalized as PartnerRegistrationStatus : "RECEIVED";
}

export function isPartnerRegistrationType(value: string): value is PartnerRegistrationType {
  return partnerRegistrationTypes.includes(value as PartnerRegistrationType);
}

export function normalizePartnerRegistration(registrationId: string, entityType: PartnerRegistrationType, data: Record<string, unknown>): PartnerRegistration {
  const entityId = text(data[`${entityType}_id`] ?? data.school_id);
  return {
    registrationId, entityType, entityId,
    displayName: text(data.display_name ?? data.school_name) || "Unnamed location",
    formattedAddress: text(data.formatted_address), locality: text(data.locality),
    cityCode: text(data.city_code), cityName: text(data.city_name) || text(data.city_code),
    zoneCode: text(data.zone_code), zoneName: text(data.zone_name) || text(data.zone_code),
    status: normalizePartnerStatus(data.status), contactName: nullableText(data.contact_name),
    contactDesignation: nullableText(data.contact_designation), contactPhone: nullableText(data.contact_phone),
    contactEmail: nullableText(data.contact_email), strength: number(data.student_strength ?? data.employee_strength),
    expectedLunchUsers: number(data.expected_lunch_users), mealInterest: nullableText(data.meal_interest),
    assignedTo: nullableText(data.assigned_to), followUpAt: timestampIso(data.follow_up_at),
    notes: nullableText(data.internal_notes ?? data.notes), createdAt: timestampIso(data.created_at ?? data.last_requested_at),
    updatedAt: timestampIso(data.updated_at ?? data.last_requested_at), duplicateCount: 0,
  };
}

export function addDuplicateCounts(registrations: PartnerRegistration[]) {
  const counts = new Map<string, number>();
  for (const item of registrations) {
    const key = `${item.entityType}:${item.entityId || item.displayName.toLocaleLowerCase("en-IN")}:${item.cityCode}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return registrations.map((item) => ({ ...item, duplicateCount: counts.get(`${item.entityType}:${item.entityId || item.displayName.toLocaleLowerCase("en-IN")}:${item.cityCode}`) || 1 }));
}
