import { firestoreClient, isFirestoreConfigured } from "@/lib/firestore";
import { gradePortionMultiplier, resolvePriceTier } from "@/lib/pricing";
import { cities as fallbackCities, gradePlans as fallbackGradePlans, meals as fallbackMeals, schools as fallbackSchools, type GradePlan, type Meal, type School } from "@/lib/meals";

export type Catalog = {
  cities: string[];
  schools: School[];
  meals: Meal[];
  gradePlans: Record<string, GradePlan>;
  source: "firestore" | "fallback" | "mixed";
};

const cityNames: Record<string, string> = {
  chennai: "Chennai",
  madurai: "Madurai",
  trichy: "Trichy",
  coimbatore: "Coimbatore",
};

function dateValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String((value as { value: unknown }).value);
  return String(value || "");
}

function mealDateLabels(serviceDate: string) {
  const date = new Date(`${serviceDate}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(date),
    shortDate: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date),
  };
}

function chronologicalMeals(entries: Meal[]) {
  return [...entries]
    .map((meal) => {
      const labels = mealDateLabels(meal.serviceDate);
      return labels ? { ...meal, ...labels } : meal;
    })
    .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
}

export async function getCatalog(): Promise<Catalog> {
  if (!isFirestoreConfigured()) {
    return { cities: fallbackCities, schools: fallbackSchools, meals: fallbackMeals, gradePlans: fallbackGradePlans, source: "fallback" };
  }

  const firestore = firestoreClient();
  const [citySnapshot, schoolSnapshot, mealSnapshot, gradeSnapshot] = await Promise.all([
    firestore.collection("cities").where("active", "==", true).get(),
    firestore.collection("schools").where("active", "==", true).get(),
    firestore.collection("meal_packages").where("is_available", "==", true).get(),
    firestore.collection("grade_nutrition_plans").where("active", "==", true).get(),
  ]);

  const managedCities = citySnapshot.docs.map((document) => String(document.get("city_name"))).filter(Boolean);
  const managedSchools = schoolSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      name: String(data.school_name),
      city: cityNames[String(data.city_id)] || String(data.city),
      area: String(data.area),
      kitchenId: String(data.kitchen_id),
      priceTier: resolvePriceTier({ priceTier: data.price_tier }),
    } satisfies School;
  });
  const managedMeals = mealSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      serviceDate: dateValue(data.service_date),
      day: String(data.day),
      shortDate: String(data.short_date),
      name: String(data.meal_name),
      description: String(data.description),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : ["Vegetarian"],
      protein: Number(data.protein_g || 0),
      calories: Number(data.calories || 0),
      price: Number(data.price_inr || 0),
      rating: Number(data.rating || 0),
      color: String(data.color || "green"),
      emoji: String(data.emoji || "🍱"),
      nutritionStatus: data.nutrition_status === "dietitian-approved" ? "dietitian-approved" : "provisional",
    } satisfies Meal;
  });
  const managedGradePlans = Object.fromEntries(gradeSnapshot.docs.map((document) => {
    const data = document.data();
    const multiplier = gradePortionMultiplier(document.id);
    if (multiplier === null) return [];
    return [document.id, {
      id: document.id,
      label: String(data.label),
      targetCalories: Number(data.target_calories),
      targetProteinG: Number(data.target_protein_g),
      multiplier,
      nutritionStatus: data.nutrition_status === "dietitian-approved" ? "dietitian-approved" : "provisional",
    } satisfies GradePlan];
  }).filter((entry) => entry.length === 2));

  const cities = managedCities.length ? managedCities : fallbackCities;
  const schools = managedSchools.length ? managedSchools : fallbackSchools;
  const meals = chronologicalMeals(managedMeals.length ? managedMeals : fallbackMeals);
  const gradePlans = Object.keys(managedGradePlans).length ? managedGradePlans : fallbackGradePlans;
  const managedSets = [managedCities.length, managedSchools.length, managedMeals.length, Object.keys(managedGradePlans).length].filter(Boolean).length;
  return { cities, schools, meals, gradePlans, source: managedSets === 4 ? "firestore" : "mixed" };
}
