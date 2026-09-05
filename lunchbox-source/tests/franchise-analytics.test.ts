import { describe, expect, it } from "vitest";
import { buildFranchiseLocationInsights, canonicalFranchiseCity } from "@/lib/franchise-analytics";
import type { Franchise } from "@/lib/franchises";

function franchise(id: string, city: string, category: string, studentCount: number, mapped = false): Franchise {
  return {
    id, city, category, studentCount, name: id, address: "", phone: "", email: "", description: "", imageUrl: "",
    companyName: "", area: "", website: "", rating: null, reviews: null, mapsUrl: "", sourceUrl: "", lastVerifiedAt: "",
    location: mapped ? { lat: 10, lng: 78 } : null,
  };
}

const records = [
  franchise("chennai-a", "Chennai", "Kitchen", 120, true),
  franchise("madurai-a", "madurai", "Cafe", 40),
  franchise("trichy-a", "Tiruchirappalli", "Kitchen", 60, true),
  franchise("coimbatore-a", "Coimbatore", "Cafe", 80),
];

describe("franchise location insights", () => {
  it("supports All and the four requested cities", () => {
    const insights = buildFranchiseLocationInsights(records, "All");
    expect(insights.totalFranchises).toBe(4);
    expect(insights.totalStudents).toBe(300);
    expect(insights.mappedLocations).toBe(2);
    expect(insights.cityRows.map((row) => row.city)).toEqual(["Chennai", "Madurai", "Trichy", "Coimbatore"]);
  });

  it("updates metrics, graphs, and records for the selected city", () => {
    const insights = buildFranchiseLocationInsights(records, "Trichy");
    expect(insights.franchises.map((item) => item.id)).toEqual(["trichy-a"]);
    expect(insights.totalStudents).toBe(60);
    expect(insights.categoryRows).toEqual([{ category: "Kitchen", count: 1 }]);
  });

  it("normalizes Tiruchirappalli to Trichy", () => {
    expect(canonicalFranchiseCity(" Tiruchirappalli ")).toBe("Trichy");
  });
});
