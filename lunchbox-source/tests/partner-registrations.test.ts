import { describe, expect, it } from "vitest";
import { addDuplicateCounts, normalizePartnerRegistration, normalizePartnerStatus, timestampIso } from "@/lib/partner-registrations";

describe("partner registration administration", () => {
  it("normalizes a company registration without exposing unknown fields", () => {
    expect(normalizePartnerRegistration("CR-ABC12345", "company", {
      company_id: "COMPANY-1", display_name: "Acme Technologies", city_code: "CHENNAI",
      zone_code: "CHENNAI_WEST", employee_strength: 500, expected_lunch_users: 220,
      contact_name: "Operations Lead", status: "under review", created_at: { seconds: 1_700_000_000 },
    })).toMatchObject({ registrationId: "CR-ABC12345", entityType: "company", entityId: "COMPANY-1", displayName: "Acme Technologies", status: "UNDER_REVIEW", strength: 500, expectedLunchUsers: 220 });
  });

  it("normalizes legacy and invalid statuses safely", () => {
    expect(normalizePartnerStatus("pilot scheduled")).toBe("PILOT_SCHEDULED");
    expect(normalizePartnerStatus("unknown")).toBe("RECEIVED");
  });

  it("detects repeat registrations for the same entity", () => {
    const first = normalizePartnerRegistration("OR-ONE12345", "office", { office_id: "OFFICE-1", display_name: "DLF Office", city_code: "CHENNAI" });
    const second = normalizePartnerRegistration("OR-TWO12345", "office", { office_id: "OFFICE-1", display_name: "DLF Office", city_code: "CHENNAI" });
    expect(addDuplicateCounts([first, second]).map((item) => item.duplicateCount)).toEqual([2, 2]);
  });

  it("normalizes Firestore timestamps for follow-up display", () => {
    expect(timestampIso({ seconds: 1_700_000_000 })).toBe("2023-11-14T22:13:20.000Z");
  });
});
