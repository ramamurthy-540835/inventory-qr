export const franchiseApplicationStatuses = ["RECEIVED", "UNDER_REVIEW", "SHORTLISTED", "REJECTED"] as const;

export type FranchiseApplicationStatus = typeof franchiseApplicationStatuses[number];

export type FranchiseApplication = {
  referenceId: string;
  applicantName: string;
  phone: string;
  email: string;
  selectedCity: string;
  investmentReadiness: string;
  experienceBackground: string;
  submittedAt: string | null;
  status: FranchiseApplicationStatus;
  notes: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(data[key]);
    if (value) return value;
  }
  return "";
}

function submittedAt(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  }
  return null;
}

export function normalizeFranchiseStatus(value: unknown): FranchiseApplicationStatus {
  const normalized = text(value).toUpperCase().replace(/[ -]+/g, "_");
  if (normalized === "NEW") return "RECEIVED";
  return franchiseApplicationStatuses.includes(normalized as FranchiseApplicationStatus)
    ? normalized as FranchiseApplicationStatus
    : "RECEIVED";
}

export function toFranchiseApplication(referenceId: string, data: Record<string, unknown>): FranchiseApplication {
  const occupation = firstText(data, ["experience_background", "experience", "background", "occupation"]);
  const motivation = firstText(data, ["motivation"]);
  const experienceBackground = occupation && motivation && occupation !== motivation
    ? `${occupation}\n\n${motivation}`
    : occupation || motivation;

  return {
    referenceId,
    applicantName: firstText(data, ["applicant_name", "full_name", "name"]),
    phone: firstText(data, ["phone", "phone_number", "mobile"]),
    email: firstText(data, ["email", "email_address"]),
    selectedCity: firstText(data, ["selected_city", "city"]),
    investmentReadiness: firstText(data, ["investment_readiness", "investmentReadiness"]),
    experienceBackground,
    submittedAt: submittedAt(data.submitted_at ?? data.created_at),
    status: normalizeFranchiseStatus(data.status),
    notes: firstText(data, ["notes", "admin_notes"]) || null,
  };
}
