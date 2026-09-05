export const MARKET_PRICE = 39;
export const MEAL_AUDIENCE_PRICES = {
  senior: 29,
  school: 39,
  college: 49,
  working: 59,
} as const;

export type MealAudience = keyof typeof MEAL_AUDIENCE_PRICES;

export function isMealAudience(value: unknown): value is MealAudience {
  return typeof value === "string" && value in MEAL_AUDIENCE_PRICES;
}

export function mealAudiencePrice(audience: MealAudience) {
  return MEAL_AUDIENCE_PRICES[audience];
}
export const SPONSORED_PRICE = 39;
export const FREE_MEALS_DAILY_CAP = 25;
export const FREE_MEALS_PER_TYPE_ORDER_CAP = 2;
export const DEFAULT_DIRECT_COST_PER_MEAL = 27;
export const DEFAULT_MONTHLY_FIXED_COST = 124000;

export type PriceTier = "market" | "sponsored";
export type FreeMealType = "senior" | "parent";

export const GRADE_PORTION_MULTIPLIERS = {
  "6-8": 1.15,
  "9-10": 1.35,
  "11-12": 1.55,
} as const;

export type GradeBand = keyof typeof GRADE_PORTION_MULTIPLIERS;

export function resolvePriceTier(school: { priceTier?: unknown }): PriceTier {
  return school.priceTier === "sponsored" ? "sponsored" : "market";
}

export function schoolMealPrice(school: { priceTier?: unknown }) {
  return resolvePriceTier(school) === "sponsored" ? SPONSORED_PRICE : MARKET_PRICE;
}

export function gradePortionMultiplier(gradeBand: string) {
  return GRADE_PORTION_MULTIPLIERS[gradeBand as GradeBand] ?? null;
}

export function assertFreeMealOrderCaps(freeMeals: Array<{ type: FreeMealType; quantity: number }>) {
  const totals: Record<FreeMealType, number> = { senior: 0, parent: 0 };
  for (const item of freeMeals) totals[item.type] += item.quantity;
  if (totals.senior > FREE_MEALS_PER_TYPE_ORDER_CAP || totals.parent > FREE_MEALS_PER_TYPE_ORDER_CAP) {
    throw new Error(`A maximum of ${FREE_MEALS_PER_TYPE_ORDER_CAP} free meals per type is allowed in one order.`);
  }
  return totals;
}

export function canReserveDailyFreeMeals(current: number, requested: number, cap = FREE_MEALS_DAILY_CAP) {
  return Number.isInteger(current) && current >= 0 && Number.isInteger(requested) && requested >= 0 && current + requested <= cap;
}

export function positiveMoneyConfig(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
