import { describe, expect, it } from "vitest";
import { buildOperationsSummary } from "@/lib/operations";

describe("franchise operations summary", () => {
  it("computes production, revenue and grade-scaled ingredient quantities server-side", () => {
    const summary = buildOperationsSummary([{
      school_id: "school-1",
      school_name: "Pilot School",
      kitchen_id: "kitchen-1",
      grade_band: "6-8",
      status: "CONFIRMED",
      items_json: JSON.stringify([{ meal_id: "meal-1", service_date: "2026-08-10", quantity: 2, unit_price_inr: 49 }]),
      free_meals_json: JSON.stringify([{ meal_id: "meal-1", service_date: "2026-08-10", free_meal_type: "senior", quantity: 1 }]),
    }], "kitchen-1", "2026-08-10", {}, 49);

    expect(summary.daily).toMatchObject({ paidMeals: 2, freeMeals: 1, producedMeals: 3, revenue: 98, foodValue: 81, contribution: 17 });
    expect(summary.daily.productionSheet).toMatchObject({ chapatis: 4, riceBowls: 4, curryPortions: 7 });
    expect(summary.monthToDate.freeMealSubsidyCost).toBe(49);
  });
});
