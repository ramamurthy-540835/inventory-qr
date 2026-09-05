import { describe, expect, it } from "vitest";
import { buildFranchiseOpportunityNetwork, FRANCHISE_DAILY_STUDENT_CAPACITY, FRANCHISE_NETWORK_TARGET } from "@/lib/franchise-opportunities";

describe("franchise opportunity network", () => {
  it("groups city, region and area while calculating service capacity", () => {
    const result = buildFranchiseOpportunityNetwork([
      { id: "adyar", name: "Adyar", city: "Chennai", zoneId: "south", zoneName: "South Chennai", plannedFranchiseCount: 14, franchiseCount: 3, studentCount: 2_000, status: "available" },
      { id: "rs-puram", name: "RS Puram", city: "Coimbatore", regionId: "west", regionName: "West Coimbatore", franchiseSlots: 2, activeFranchiseCount: 2, status: "available" },
    ]);
    expect(result.cities.map((city) => city.name)).toEqual(["Chennai", "Coimbatore"]);
    expect(result.cities[0].zones[0].locations[0]).toMatchObject({
      id: "adyar", plannedFranchiseCount: 14, availableFranchiseCount: 11,
      dailyStudentCapacity: 1_500, totalDailyStudentCapacity: 21_000, remainingStudentCapacity: 19_000,
    });
    expect(result.cities[1].zones[0].locations[0].status).toBe("completed");
    expect(result.network).toMatchObject({ plannedFranchises: FRANCHISE_NETWORK_TARGET, publishedFranchises: 16, availableFranchises: 11, dailyStudentsPerFranchise: FRANCHISE_DAILY_STUDENT_CAPACITY });
  });

  it("never reports fewer planned franchises than active franchises", () => {
    const result = buildFranchiseOpportunityNetwork([{ id: "area", city: "Madurai", name: "Area", zoneId: "central", plannedFranchiseCount: 1, franchiseCount: 4 }]);
    expect(result.cities[0].zones[0].locations[0]).toMatchObject({ plannedFranchiseCount: 4, availableFranchiseCount: 0, status: "completed" });
  });
});
