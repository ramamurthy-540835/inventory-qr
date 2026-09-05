import { describe, expect, it } from "vitest";
import { buildMarketingSeeds, outcomeToLeadStage } from "../lib/marketing-events";

describe("marketing events integration", () => {
  it("maps outreach outcomes onto the existing pipeline stages", () => {
    expect(outcomeToLeadStage("NO_ANSWER")).toBe("Contacted");
    expect(outcomeToLeadStage("FOLLOW_UP_NEEDED")).toBe("Contacted");
    expect(outcomeToLeadStage("INTERESTED")).toBe("Interested");
    expect(outcomeToLeadStage("MEETING_SCHEDULED")).toBe("Meeting");
    expect(outcomeToLeadStage("CONVERTED")).toBe("Meeting");
  });

  it("creates the requested local test dataset against pipeline lead ids", () => {
    const leads = [
      { id: "lead-1", name: "Adyar School", city: "Chennai" as const, zone: "East / North-East Chennai", area: "Adyar" },
      { id: "lead-2", name: "Velachery College", city: "Chennai" as const, zone: "South / South-East Chennai", area: "Velachery" },
      { id: "lead-3", name: "Anna Nagar Community", city: "Chennai" as const, zone: "West Chennai", area: "Anna Nagar" },
    ];
    const seed = buildMarketingSeeds(leads, new Date("2026-08-11T08:00:00.000Z"));
    expect(seed.events).toHaveLength(3);
    expect(seed.activities).toHaveLength(5);
    expect(seed.events.flatMap((event) => event.linkedLeadIds).every((id) => leads.some((lead) => lead.id === id))).toBe(true);
    expect(seed.activities.every((activity) => leads.some((lead) => lead.id === activity.leadId))).toBe(true);
  });
});
