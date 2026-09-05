import { describe, expect, it } from "vitest";
import { canAccessFranchise } from "@/lib/firebase-admin";

describe("franchise access claims", () => {
  it("allows admins to access every franchise", () => expect(canAccessFranchise({ admin: true }, "franchise-a")).toBe(true));
  it("limits franchise users to their assigned franchise IDs", () => {
    expect(canAccessFranchise({ roles: ["franchise"], franchise_ids: ["franchise-a"] }, "franchise-a")).toBe(true);
    expect(canAccessFranchise({ roles: ["franchise"], franchise_ids: ["franchise-a"] }, "franchise-b")).toBe(false);
  });
});
