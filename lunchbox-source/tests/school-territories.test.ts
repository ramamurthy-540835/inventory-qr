import { describe, expect, it } from "vitest";
import { SCHOOL_CITIES, resolveSchoolZone } from "@/lib/school-locator/territories";

describe("school territories", () => {
  it("defines exactly four cities and twenty zones", () => {
    expect(SCHOOL_CITIES).toHaveLength(4);
    expect(SCHOOL_CITIES.flatMap((city) => city.zones)).toHaveLength(20);
    expect(SCHOOL_CITIES.every((city) => city.zones.length === 5)).toBe(true);
  });

  it.each([
    ["CHENNAI", "Gerugambakkam", "CHENNAI_WEST"],
    ["COIMBATORE", "Peelamedu", "COIMBATORE_EAST"],
    ["TRICHY", "KK Nagar Trichy", "TRICHY_SOUTH"],
    ["MADURAI", "Tiruppalai", "MADURAI_NORTH"],
  ] as const)("resolves %s / %s to %s", (cityCode, address, expected) => {
    expect(resolveSchoolZone({ cityCode, address })?.zoneCode).toBe(expected);
  });
});
