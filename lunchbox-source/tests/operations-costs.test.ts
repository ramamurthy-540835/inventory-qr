import { describe, expect, it } from "vitest";
import { dailyExpenseTotal, initialOperationsPlan, monthlyPayroll, normalizeDailyExpenses } from "@/lib/operations-costs";

describe("operations costs", () => {
  it("preserves the supplied monthly staffing plan", () => {
    expect(initialOperationsPlan.staff).toHaveLength(7);
    expect(monthlyPayroll(initialOperationsPlan)).toBe(260000);
    expect(initialOperationsPlan.staff.filter((member) => member.needsConfirmation).map((member) => member.name)).toEqual(["Sister", "Sweety Annie"]);
  });

  it("keeps uncertain production values visibly flagged", () => {
    const uncertain = initialOperationsPlan.morningProduction.filter((item) => item.needsConfirmation).map((item) => item.id);
    expect(uncertain).toEqual(["idly", "dosa", "chapati", "vada"]);
  });

  it("normalizes and totals daily maintenance expenses", () => {
    const expenses = normalizeDailyExpenses({ gas: "250", water: 80.5, cleaning: -10, other: 20 });
    expect(expenses.cleaning).toBe(0);
    expect(dailyExpenseTotal(expenses)).toBe(350.5);
  });
});
