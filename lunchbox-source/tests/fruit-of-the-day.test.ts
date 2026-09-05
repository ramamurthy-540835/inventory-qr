import { describe, expect, it } from "vitest";
import { getFruitOfTheDay } from "@/lib/lunchbox/fruit-of-the-day";

describe("getFruitOfTheDay", () => {
  it("is deterministic for one Asia/Kolkata calendar date", () => {
    expect(getFruitOfTheDay(new Date("2026-08-22T01:00:00Z"))).toBe(getFruitOfTheDay(new Date("2026-08-22T15:00:00Z")));
  });
  it("returns a supported fruit", () => expect(["mango", "apple", "orange", "guava", "banana", "pomegranate", "grapes"]).toContain(getFruitOfTheDay()));
});
