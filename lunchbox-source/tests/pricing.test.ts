import { describe, expect, it } from "vitest";
import {
  FREE_MEALS_DAILY_CAP,
  GRADE_PORTION_MULTIPLIERS,
  MARKET_PRICE,
  MEAL_AUDIENCE_PRICES,
  SPONSORED_PRICE,
  assertFreeMealOrderCaps,
  canReserveDailyFreeMeals,
  gradePortionMultiplier,
  isMealAudience,
  mealAudiencePrice,
  resolvePriceTier,
  schoolMealPrice,
} from "@/lib/pricing";

describe("school pricing tiers", () => {
  it("defaults every school to the market tier", () => {
    expect(resolvePriceTier({})).toBe("market");
    expect(schoolMealPrice({})).toBe(MARKET_PRICE);
  });

  it("uses ₹39 only for explicitly sponsored schools", () => {
    expect(resolvePriceTier({ priceTier: "sponsored" })).toBe("sponsored");
    expect(schoolMealPrice({ priceTier: "sponsored" })).toBe(SPONSORED_PRICE);
    expect(schoolMealPrice({ priceTier: "invalid" })).toBe(MARKET_PRICE);
  });
});

describe("meal audience pricing", () => {
  it("uses the approved audience prices", () => {
    expect(MEAL_AUDIENCE_PRICES).toEqual({ senior: 29, school: 39, college: 49, working: 59 });
    expect(mealAudiencePrice("senior")).toBe(29);
    expect(mealAudiencePrice("school")).toBe(39);
    expect(mealAudiencePrice("college")).toBe(49);
    expect(mealAudiencePrice("working")).toBe(59);
  });

  it("only accepts known audience identifiers", () => {
    expect(isMealAudience("school")).toBe(true);
    expect(isMealAudience("parent")).toBe(false);
  });
});

describe("grade portion multipliers", () => {
  it("uses the approved multipliers", () => {
    expect(GRADE_PORTION_MULTIPLIERS).toEqual({ "6-8": 1.15, "9-10": 1.35, "11-12": 1.55 });
    expect(gradePortionMultiplier("6-8")).toBe(1.15);
    expect(gradePortionMultiplier("unknown")).toBeNull();
  });
});

describe("free meal caps", () => {
  it("accepts the daily boundary at exactly 25", () => {
    expect(canReserveDailyFreeMeals(24, 1)).toBe(true);
    expect(canReserveDailyFreeMeals(25, 0)).toBe(true);
  });

  it("rejects consumption above 25", () => {
    expect(canReserveDailyFreeMeals(25, 1)).toBe(false);
    expect(canReserveDailyFreeMeals(24, 2, FREE_MEALS_DAILY_CAP)).toBe(false);
  });

  it("keeps the per-order maximum at two per type", () => {
    expect(assertFreeMealOrderCaps([{ type: "senior", quantity: 2 }, { type: "parent", quantity: 2 }])).toEqual({ senior: 2, parent: 2 });
    expect(() => assertFreeMealOrderCaps([{ type: "senior", quantity: 3 }])).toThrow(/maximum of 2/i);
  });
});
