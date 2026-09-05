import { DEFAULT_DIRECT_COST_PER_MEAL, DEFAULT_MONTHLY_FIXED_COST, gradePortionMultiplier, positiveMoneyConfig, type FreeMealType } from "@/lib/pricing";

type PaidItem = { meal_id: string; service_date: string; quantity: number; unit_price_inr: number };
type FreeItem = { meal_id: string; service_date: string; free_meal_type: FreeMealType; quantity: number };

export type OperationsOrder = {
  school_id: string;
  school_name: string;
  kitchen_id: string;
  grade_band: string;
  status: string;
  items_json: string;
  free_meals_json?: string;
};

export type KitchenCostConfig = { directCostPerMeal?: unknown; monthlyFixedCost?: unknown };

function parseArray<T>(value: string | undefined): T[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function monthOf(serviceDate: string) {
  return serviceDate.slice(0, 7);
}

export function buildOperationsSummary(
  orders: OperationsOrder[],
  kitchenId: string,
  serviceDate: string,
  config: KitchenCostConfig,
  freeMealSubsidyCost: number,
) {
  const directCostPerMeal = positiveMoneyConfig(config.directCostPerMeal, DEFAULT_DIRECT_COST_PER_MEAL);
  const monthlyFixedCost = positiveMoneyConfig(config.monthlyFixedCost, DEFAULT_MONTHLY_FIXED_COST);
  const serviceMonth = monthOf(serviceDate);
  const breakdown = new Map<string, { schoolId: string; schoolName: string; gradeBand: string; paidMeals: number; freeMeals: number; producedMeals: number }>();
  let dailyPaid = 0;
  let dailyFree = 0;
  let dailyRevenue = 0;
  let monthPaid = 0;
  let monthFree = 0;
  let monthRevenue = 0;
  let chapatis = 0;
  let riceBowls = 0;
  let curryPortions = 0;

  for (const order of orders.filter((entry) => entry.kitchen_id === kitchenId && entry.status === "CONFIRMED")) {
    const paidItems = parseArray<PaidItem>(order.items_json);
    const freeItems = parseArray<FreeItem>(order.free_meals_json);
    const gradeMultiplier = gradePortionMultiplier(order.grade_band) || 1;
    const dayPaid = paidItems.filter((item) => item.service_date === serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const dayFree = freeItems.filter((item) => item.service_date === serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const produced = dayPaid + dayFree;
    dailyPaid += dayPaid;
    dailyFree += dayFree;
    dailyRevenue += paidItems.filter((item) => item.service_date === serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price_inr || 0), 0);
    monthPaid += paidItems.filter((item) => monthOf(item.service_date) === serviceMonth && item.service_date <= serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    monthFree += freeItems.filter((item) => monthOf(item.service_date) === serviceMonth && item.service_date <= serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    monthRevenue += paidItems.filter((item) => monthOf(item.service_date) === serviceMonth && item.service_date <= serviceDate).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price_inr || 0), 0);

    if (produced > 0) {
      const key = `${order.school_id}:${order.grade_band}`;
      const current = breakdown.get(key) || { schoolId: order.school_id, schoolName: order.school_name, gradeBand: order.grade_band, paidMeals: 0, freeMeals: 0, producedMeals: 0 };
      current.paidMeals += dayPaid;
      current.freeMeals += dayFree;
      current.producedMeals += produced;
      breakdown.set(key, current);
      chapatis += produced * gradeMultiplier;
      riceBowls += produced * gradeMultiplier;
      curryPortions += produced * gradeMultiplier * 2;
    }
  }

  const dailyProduced = dailyPaid + dailyFree;
  const monthProduced = monthPaid + monthFree;
  const dailyFoodValue = dailyProduced * directCostPerMeal;
  const monthFoodValue = monthProduced * directCostPerMeal;
  const contributionBeforeFixed = monthRevenue - monthFoodValue;
  const contributionAfterFixed = contributionBeforeFixed - monthlyFixedCost;

  return {
    kitchenId,
    serviceDate,
    config: { directCostPerMeal, monthlyFixedCost },
    daily: {
      paidMeals: dailyPaid,
      freeMeals: dailyFree,
      producedMeals: dailyProduced,
      revenue: dailyRevenue,
      foodValue: dailyFoodValue,
      contribution: dailyRevenue - dailyFoodValue,
      breakdown: [...breakdown.values()].sort((a, b) => a.schoolName.localeCompare(b.schoolName) || a.gradeBand.localeCompare(b.gradeBand)),
      productionSheet: {
        chapatis: Math.ceil(chapatis),
        riceBowls: Math.ceil(riceBowls),
        curryPortions: Math.ceil(curryPortions),
        sambarPortions: dailyProduced,
        curdPortions: dailyProduced,
        channaPortions: dailyProduced,
        appalams: dailyProduced,
      },
    },
    monthToDate: {
      serviceMonth,
      paidMeals: monthPaid,
      freeMeals: monthFree,
      producedMeals: monthProduced,
      revenue: monthRevenue,
      foodValue: monthFoodValue,
      freeMealSubsidyCost,
      contributionBeforeFixed,
      monthlyFixedCost,
      contributionAfterFixed,
      indicator: contributionAfterFixed >= 0 ? "on-track" : "loss",
    },
  };
}
