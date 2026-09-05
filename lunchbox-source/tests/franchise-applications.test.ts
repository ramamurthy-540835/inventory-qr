import { describe, expect, it } from "vitest";
import { normalizeFranchiseStatus, toFranchiseApplication } from "@/lib/franchise-applications";

describe("franchise application records", () => {
  it("normalizes the public application form record for the admin view", () => {
    const application = toFranchiseApplication("FR-FA5B231F", {
      full_name: "Anita Kumar",
      phone: "9876543210",
      email: "anita@example.com",
      city: "Chennai",
      investment_readiness: "Funds available now",
      occupation: "Restaurant operator",
      motivation: "I have managed food operations for eight years.",
      status: "NEW",
      created_at: { seconds: 1_786_000_000 },
    });

    expect(application).toMatchObject({
      referenceId: "FR-FA5B231F",
      applicantName: "Anita Kumar",
      selectedCity: "Chennai",
      status: "RECEIVED",
      notes: null,
    });
    expect(application.experienceBackground).toContain("Restaurant operator");
    expect(application.submittedAt).toMatch(/^2026-/);
  });

  it("supports each admin status and safely defaults unknown values", () => {
    expect(normalizeFranchiseStatus("under review")).toBe("UNDER_REVIEW");
    expect(normalizeFranchiseStatus("SHORTLISTED")).toBe("SHORTLISTED");
    expect(normalizeFranchiseStatus("rejected")).toBe("REJECTED");
    expect(normalizeFranchiseStatus("unexpected")).toBe("RECEIVED");
  });
});
