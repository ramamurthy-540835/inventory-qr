import { describe, expect, it } from "vitest";
import { canEnterAct, initialBookingState, reducer } from "@/lib/book-machine";

const ready = { ...initialBookingState, city: "Chennai", school: { id: "s", name: "Pilot", kitchenId: "k" }, gradeBand: "6-8", studentName: "Nila", mealIds: ["m"], allergyAcknowledged: true, parentPhone: "9876543210" };

describe("cinematic booking guards", () => {
  it("keeps review unreachable until the required data is present", () => {
    expect(canEnterAct(initialBookingState, 7)).toBe(false);
    expect(canEnterAct(ready, 7)).toBe(true);
  });
  it("preserves selected days when moving back from the calendar", () => {
    const state = { ...ready, act: 5 as const };
    expect(reducer(state, { type: "BACK" })).toMatchObject({ act: 4, mealIds: ["m"] });
  });
  it("creates a booking key only once", () => {
    const first = reducer(ready, { type: "BOOKING_KEY", key: "first-key" });
    expect(reducer(first, { type: "BOOKING_KEY", key: "second-key" }).idempotencyKey).toBe("first-key");
  });
});
