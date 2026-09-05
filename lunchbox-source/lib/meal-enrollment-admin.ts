import { timestampIso } from "@/lib/partner-registrations";

export const mealEnrollmentTypes = ["SCHOOL_CHILD", "COLLEGE_STUDENT", "OFFICE_WORKER"] as const;
export type MealEnrollmentType = typeof mealEnrollmentTypes[number];
export const mealEnrollmentStatuses = ["RECEIVED", "UNDER_REVIEW", "CONTACTED", "ACTIVE", "PAUSED", "CANCELLED"] as const;
export type MealEnrollmentStatus = typeof mealEnrollmentStatuses[number];

export type MealEnrollmentAdmin = {
  registrationId: string; registrationType: MealEnrollmentType; personName: string; guardianName: string | null;
  contactPhone: string; contactEmail: string | null; locationName: string; formattedAddress: string; locality: string;
  cityCode: string; zoneCode: string; gradeOrCourse: string | null; identifier: string | null; dietaryPreference: string | null;
  allergies: string | null; mealPlanInterest: string | null; preferredMealTime: string | null; status: MealEnrollmentStatus;
  assignedTo: string | null; followUpAt: string | null; notes: string | null; createdAt: string | null;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function nullable(value: unknown) { return text(value) || null; }
export function normalizeMealEnrollmentStatus(value: unknown): MealEnrollmentStatus {
  const status = text(value).toUpperCase().replace(/[ -]+/g, "_");
  return mealEnrollmentStatuses.includes(status as MealEnrollmentStatus) ? status as MealEnrollmentStatus : "RECEIVED";
}
export function normalizeMealEnrollment(id: string, data: Record<string, unknown>): MealEnrollmentAdmin {
  const registrationType = mealEnrollmentTypes.includes(data.registration_type as MealEnrollmentType) ? data.registration_type as MealEnrollmentType : "SCHOOL_CHILD";
  const gradeOrCourse = registrationType === "SCHOOL_CHILD" ? nullable(data.grade) : registrationType === "COLLEGE_STUDENT" ? nullable(data.course_name) : nullable(data.department ?? data.designation);
  const identifier = registrationType === "SCHOOL_CHILD" ? nullable(data.section) : registrationType === "COLLEGE_STUDENT" ? nullable(data.student_id) : nullable(data.employee_id);
  return {
    registrationId: id, registrationType, personName: text(data.person_name ?? data.child_name ?? data.student_name ?? data.employee_name) || "Unnamed registrant",
    guardianName: nullable(data.parent_name), contactPhone: text(data.contact_phone ?? data.parent_phone ?? data.student_phone ?? data.employee_phone),
    contactEmail: nullable(data.contact_email ?? data.parent_email ?? data.student_email ?? data.employee_email),
    locationName: text(data.school_name ?? data.display_name) || "Unknown location", formattedAddress: text(data.formatted_address), locality: text(data.locality),
    cityCode: text(data.city_code), zoneCode: text(data.zone_code), gradeOrCourse, identifier,
    dietaryPreference: nullable(data.dietary_preference), allergies: nullable(data.allergies), mealPlanInterest: nullable(data.meal_plan_interest),
    preferredMealTime: nullable(data.preferred_meal_time), status: normalizeMealEnrollmentStatus(data.status), assignedTo: nullable(data.assigned_to),
    followUpAt: timestampIso(data.follow_up_at), notes: nullable(data.internal_notes ?? data.notes), createdAt: timestampIso(data.created_at),
  };
}
