import { GRADE_PORTION_MULTIPLIERS, MARKET_PRICE, gradePortionMultiplier, type PriceTier } from "@/lib/pricing";

export type Meal = {
  id: string;
  serviceDate: string;
  day: string;
  shortDate: string;
  name: string;
  description: string;
  tags: string[];
  protein: number;
  calories: number;
  price: number;
  rating: number;
  color: string;
  emoji: string;
  nutritionStatus: "provisional" | "dietitian-approved";
};

export type School = {
  id: string;
  name: string;
  city: string;
  area: string;
  kitchenId: string;
  priceTier: PriceTier;
};

export type GradePlan = {
  id: string;
  label: string;
  targetCalories: number;
  targetProteinG: number;
  multiplier: number;
  nutritionStatus: "provisional" | "dietitian-approved";
};

export function mealNutrition(meal: Meal, gradePlan: GradePlan) {
  const multiplier = gradePortionMultiplier(gradePlan.id) ?? gradePlan.multiplier;
  return {
    estimatedCalories: Math.round(meal.calories * multiplier),
    estimatedProteinG: Math.round(meal.protein * multiplier),
    targetCalories: gradePlan.targetCalories,
    targetProteinG: gradePlan.targetProteinG,
    status: meal.nutritionStatus,
  };
}

export const cities = ["Chennai", "Madurai", "Trichy", "Coimbatore"];

export const gradePlans: Record<string, GradePlan> = {
  "6-8": { id: "6-8", label: "6th–8th", targetCalories: 740, targetProteinG: 12, multiplier: GRADE_PORTION_MULTIPLIERS["6-8"], nutritionStatus: "provisional" },
  "9-10": { id: "9-10", label: "9th–10th", targetCalories: 870, targetProteinG: 15, multiplier: GRADE_PORTION_MULTIPLIERS["9-10"], nutritionStatus: "provisional" },
  "11-12": { id: "11-12", label: "11th–12th", targetCalories: 1000, targetProteinG: 18, multiplier: GRADE_PORTION_MULTIPLIERS["11-12"], nutritionStatus: "provisional" },
};

const mealDescriptions = [
  ["monday-balanced-meals", "2026-08-10", "Monday", "10 Aug", "Monday Balanced Meals", "beans curry, carrot curry", 20, 640, 4.9, "yellow"],
  ["tuesday-balanced-meals", "2026-08-11", "Tuesday", "11 Aug", "Tuesday Balanced Meals", "cabbage curry, beetroot curry", 20, 640, 4.8, "green"],
  ["wednesday-balanced-meals", "2026-08-12", "Wednesday", "12 Aug", "Wednesday Balanced Meals", "cauliflower curry, greens curry", 21, 645, 4.9, "orange"],
  ["thursday-balanced-meals", "2026-08-13", "Thursday", "13 Aug", "Thursday Balanced Meals", "potato-peas curry, pumpkin curry", 20, 650, 4.7, "red"],
  ["friday-balanced-meals", "2026-08-14", "Friday", "14 Aug", "Friday Balanced Meals", "okra curry, mixed-veg curry", 21, 645, 4.8, "purple"],
] as const;

export const meals: Meal[] = mealDescriptions.map(([id, serviceDate, day, shortDate, name, curries, protein, calories, rating, color]) => ({
  id,
  serviceDate,
  day,
  shortDate,
  name,
  description: `1 chapati, 1 bowl rice, sambar, curd, ${curries}, channa and 1 appalam.`,
  tags: ["Vegetarian", "8 items"],
  protein,
  calories,
  price: MARKET_PRICE,
  rating,
  color,
  emoji: "🍱",
  nutritionStatus: "provisional",
}));

export const schools: School[] = [
  { id: "chn-adyar-01", name: "Adyar Pilot School", city: "Chennai", area: "Adyar", kitchenId: "chn-kitchen-01", priceTier: "sponsored" },
  { id: "chn-annanagar-01", name: "Anna Nagar Pilot School", city: "Chennai", area: "Anna Nagar", kitchenId: "chn-kitchen-01", priceTier: "market" },
  { id: "md-annanagar-01", name: "Madurai Pilot School", city: "Madurai", area: "Anna Nagar", kitchenId: "md-kitchen-01", priceTier: "market" },
  { id: "md-kk-nagar-01", name: "KK Nagar Pilot School", city: "Madurai", area: "KK Nagar", kitchenId: "md-kitchen-01", priceTier: "market" },
  { id: "try-cantonment-01", name: "Trichy Pilot School", city: "Trichy", area: "Cantonment", kitchenId: "try-kitchen-01", priceTier: "market" },
  { id: "try-srirangam-01", name: "Srirangam Pilot School", city: "Trichy", area: "Srirangam", kitchenId: "try-kitchen-01", priceTier: "market" },
  { id: "cbe-rspuram-01", name: "RS Puram Pilot School", city: "Coimbatore", area: "RS Puram", kitchenId: "cbe-kitchen-01", priceTier: "market" },
  { id: "cbe-peelamedu-01", name: "Peelamedu Pilot School", city: "Coimbatore", area: "Peelamedu", kitchenId: "cbe-kitchen-01", priceTier: "market" },
];
