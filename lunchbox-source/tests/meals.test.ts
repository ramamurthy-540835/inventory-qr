import { describe, expect, it } from "vitest";
import { mealNutrition, type GradePlan, type Meal } from "@/lib/meals";

const meal: Meal = { id: "test", serviceDate: "2026-08-10", day: "Monday", shortDate: "10 Aug", name: "Balanced lunch", description: "Test meal", tags: ["Vegetarian"], protein: 20, calories: 640, price: 39, rating: 4.9, color: "green", emoji: "🍱", nutritionStatus: "provisional" };
const gradePlan: GradePlan = { id: "9-10", label: "9th–10th", targetCalories: 875, targetProteinG: 15, multiplier: 1.35, nutritionStatus: "provisional" };

describe("BigQuery meal nutrition mapping", () => {
  it("keeps estimated meal nutrition separate from grade targets", () => {
    expect(mealNutrition(meal, gradePlan)).toEqual({ estimatedCalories: 864, estimatedProteinG: 27, targetCalories: 875, targetProteinG: 15, status: "provisional" });
  });

  it("uses the market fallback price", () => {
    expect(meal.price).toBe(39);
  });
});
