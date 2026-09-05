import { describe, expect, it } from "vitest";
import { deduplicateSchools, normalizeSchoolCandidate, rankSchools } from "@/lib/school-locator/normalization";
import { toSchoolRegistrationFields } from "@/lib/school-locator/registration-fields";

function candidate(name: string, address = "Gerugambakkam, Chennai, Tamil Nadu 600122") {
  return normalizeSchoolCandidate({
    name, address, locality: "Gerugambakkam", latitude: 13.01, longitude: 80.13,
    provider: "google", providerPlaceId: name, types: ["school"],
    selectedCityCode: "CHENNAI", selectedZoneCode: "CHENNAI_WEST",
  })!;
}

describe("school normalization", () => {
  it("filters results from another supported city", () => {
    expect(normalizeSchoolCandidate({
      name: "Maharishi School", address: "Anna Nagar, Madurai, Tamil Nadu 625020", locality: "Anna Nagar",
      latitude: 9.93, longitude: 78.12, provider: "google", providerPlaceId: "wrong-city", types: ["school"],
      selectedCityCode: "CHENNAI", selectedZoneCode: "CHENNAI_WEST",
    })).toBeNull();
  });

  it("excludes colleges and coaching centres", () => {
    expect(candidate("Maharishi Engineering College")).toBeNull();
    expect(candidate("Mah Coaching Centre")).toBeNull();
  });

  it("deduplicates provider results by place ID", () => {
    const google = candidate("Maharishi Vidya Mandir");
    const serp = { ...google, id: "SERP-DUPLICATE", provider: "serpapi" as const };
    expect(deduplicateSchools([google, serp])).toHaveLength(1);
  });

  it("ranks a starts-with match above a contains match", () => {
    const starts = candidate("Maharishi Vidya Mandir");
    const contains = candidate("Sri Mahalakshmi School");
    expect(rankSchools([contains, starts], "mah", "CHENNAI_WEST")[0].school_name).toBe("Maharishi Vidya Mandir");
  });

  it("marks unresolved localities as search-context zone assignments", () => {
    const unresolved = normalizeSchoolCandidate({
      name: "Maharishi Vidya Mandir", address: "Chetpet, Chennai, Tamil Nadu 600031", locality: "Chetpet",
      latitude: 13.07, longitude: 80.23, provider: "google", providerPlaceId: "chetpet", types: ["school"],
      selectedCityCode: "CHENNAI", selectedZoneCode: "CHENNAI_WEST",
    });
    expect(unresolved).toMatchObject({ zone_resolution: "search_context", outside_selected_zone: true });
    expect(candidate("Maharishi Vidya Mandir")).toMatchObject({ zone_resolution: "locality", outside_selected_zone: false });
  });

  it("maps a selected school to registration auto-fill fields", () => {
    const school = candidate("Maharishi Vidya Mandir");
    expect(toSchoolRegistrationFields(school)).toMatchObject({
      selected_school_id: school.id,
      school_name: "Maharishi Vidya Mandir",
      school_address: "Gerugambakkam, Chennai, Tamil Nadu 600122",
      school_zone: "West Chennai",
      school_city: "Chennai",
      school_pincode: "600122",
    });
  });
});
