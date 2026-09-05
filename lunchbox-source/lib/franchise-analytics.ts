import type { Franchise } from "@/lib/franchises";

export const franchiseCities = ["Chennai", "Madurai", "Trichy", "Coimbatore"] as const;
export type FranchiseCity = typeof franchiseCities[number];
export type FranchiseCitySelection = "All" | FranchiseCity;

const cityAliases = new Map<string, FranchiseCity>([
  ["chennai", "Chennai"],
  ["madurai", "Madurai"],
  ["trichy", "Trichy"],
  ["tiruchirappalli", "Trichy"],
  ["coimbatore", "Coimbatore"],
]);

export function canonicalFranchiseCity(value: string) {
  return cityAliases.get(value.trim().toLowerCase()) || null;
}

export function buildFranchiseLocationInsights(franchises: Franchise[], selection: FranchiseCitySelection) {
  const supported = franchises.flatMap((franchise) => {
    const city = canonicalFranchiseCity(franchise.city);
    return city ? [{ franchise, city }] : [];
  });
  const selected = selection === "All" ? supported : supported.filter((item) => item.city === selection);
  const selectedFranchises = selected.map((item) => item.franchise);
  const cityRows = franchiseCities.map((city) => {
    const records = supported.filter((item) => item.city === city).map((item) => item.franchise);
    return {
      city,
      franchises: records.length,
      students: records.reduce((total, franchise) => total + franchise.studentCount, 0),
    };
  });
  const categories = new Map<string, number>();
  selectedFranchises.forEach((franchise) => {
    const category = franchise.category || "Other";
    categories.set(category, (categories.get(category) || 0) + 1);
  });

  return {
    franchises: selectedFranchises,
    totalFranchises: selectedFranchises.length,
    totalStudents: selectedFranchises.reduce((total, franchise) => total + franchise.studentCount, 0),
    mappedLocations: selectedFranchises.filter((franchise) => franchise.location).length,
    cityRows,
    categoryRows: [...categories.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
      .slice(0, 6),
  };
}
