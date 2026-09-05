import { firestoreClient } from "@/lib/firestore";

export const FRANCHISE_NETWORK_TARGET = 198;
export const FRANCHISE_DAILY_STUDENT_CAPACITY = 1_500;
export type FranchiseOpportunityStatus = "available" | "completed" | "coming_soon";
export type FranchiseOpportunityLocation = {
  id: string; name: string; cityId: string; cityName: string; zoneId: string; zoneName: string;
  status: FranchiseOpportunityStatus; franchiseCount: number; plannedFranchiseCount: number; availableFranchiseCount: number;
  activeDriverCount: number; dailyStudentCapacity: number; totalDailyStudentCapacity: number;
  currentStudentCount: number; remainingStudentCapacity: number; lat: number | null; lng: number | null;
};
export type FranchiseOpportunityZone = { id: string; name: string; icon: string; locations: FranchiseOpportunityLocation[] };
export type FranchiseOpportunityCity = { id: string; name: string; zones: FranchiseOpportunityZone[] };
export type FranchiseOpportunityNetwork = {
  cities: FranchiseOpportunityCity[]; zones: FranchiseOpportunityZone[];
  network: { plannedFranchises: number; publishedFranchises: number; availableFranchises: number; dailyStudentsPerFranchise: number; publishedDailyStudentCapacity: number };
  source: "firestore";
};

const zoneMeta: Record<string, { name: string; icon: string; order: number }> = {
  north: { name: "North", icon: "N", order: 1 }, central: { name: "Central", icon: "C", order: 2 },
  west: { name: "West", icon: "W", order: 3 }, south: { name: "South", icon: "S", order: 4 },
  east: { name: "East", icon: "E", order: 5 }, omr: { name: "OMR & ECR", icon: "↗", order: 6 },
};
const cityOrder = ["chennai", "madurai", "trichy", "coimbatore"];
const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const cleanNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const count = (value: unknown, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback; };
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "other";

export function buildFranchiseOpportunityNetwork(records: Array<Record<string, unknown> & { id: string }>): FranchiseOpportunityNetwork {
  const locations = records.map((data) => {
    const rawCity = cleanText(data.city) || "Chennai";
    const cityName = rawCity === "Tiruchirappalli" ? "Trichy" : rawCity;
    const cityId = slug(cityName);
    const zoneId = slug(cleanText(data.regionId) || cleanText(data.zoneId) || "central");
    const zoneName = cleanText(data.regionName) || cleanText(data.zoneName) || (zoneMeta[zoneId] ? zoneMeta[zoneId].name + " " + cityName : cityName);
    const rawStatus = data.status === "completed" || data.status === "coming_soon" ? data.status : "available";
    const franchiseCount = count(data.activeFranchiseCount ?? data.franchiseCount);
    const plannedFranchiseCount = Math.max(franchiseCount, count(data.plannedFranchiseCount ?? data.franchiseSlots, 1));
    const availableFranchiseCount = rawStatus === "available" ? Math.max(0, plannedFranchiseCount - franchiseCount) : 0;
    const dailyStudentCapacity = count(data.dailyStudentCapacity, FRANCHISE_DAILY_STUDENT_CAPACITY) || FRANCHISE_DAILY_STUDENT_CAPACITY;
    const currentStudentCount = count(data.currentStudentCount ?? data.studentCount);
    return {
      id: data.id, name: cleanText(data.name) || data.id, cityId, cityName, zoneId, zoneName,
      status: availableFranchiseCount === 0 && rawStatus === "available" ? "completed" as const : rawStatus,
      franchiseCount, plannedFranchiseCount, availableFranchiseCount, activeDriverCount: count(data.activeDriverCount),
      dailyStudentCapacity, totalDailyStudentCapacity: plannedFranchiseCount * dailyStudentCapacity, currentStudentCount,
      remainingStudentCapacity: Math.max(0, plannedFranchiseCount * dailyStudentCapacity - currentStudentCount),
      lat: cleanNumber(data.lat), lng: cleanNumber(data.lng),
    } satisfies FranchiseOpportunityLocation;
  });
  const cities = [...new Map(locations.map((location) => [location.cityId, { id: location.cityId, name: location.cityName }])).values()]
    .map((city) => {
      const cityLocations = locations.filter((location) => location.cityId === city.id);
      const ids = [...new Set(cityLocations.map((location) => location.zoneId))];
      const zones = ids.map((id) => ({ id, name: cityLocations.find((item) => item.zoneId === id)?.zoneName || id, icon: zoneMeta[id]?.icon || "•", locations: cityLocations.filter((item) => item.zoneId === id).sort((a, b) => a.name.localeCompare(b.name)) }))
        .sort((a, b) => (zoneMeta[a.id]?.order || 99) - (zoneMeta[b.id]?.order || 99) || a.name.localeCompare(b.name));
      return { ...city, zones };
    }).sort((a, b) => { const ai = cityOrder.indexOf(a.id); const bi = cityOrder.indexOf(b.id); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name); });
  const zones = cities.flatMap((city) => city.zones);
  const publishedFranchises = locations.reduce((sum, item) => sum + item.plannedFranchiseCount, 0);
  const availableFranchises = locations.reduce((sum, item) => sum + item.availableFranchiseCount, 0);
  return { cities, zones, network: { plannedFranchises: Math.max(FRANCHISE_NETWORK_TARGET, publishedFranchises), publishedFranchises, availableFranchises,
    dailyStudentsPerFranchise: FRANCHISE_DAILY_STUDENT_CAPACITY, publishedDailyStudentCapacity: publishedFranchises * FRANCHISE_DAILY_STUDENT_CAPACITY }, source: "firestore" };
}

export async function getFranchiseOpportunities() {
  const snapshot = await firestoreClient().collection("franchise_locations").limit(500).get();
  return buildFranchiseOpportunityNetwork(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
}
