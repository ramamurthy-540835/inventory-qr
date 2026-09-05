export type CityCode = "CHENNAI" | "COIMBATORE" | "TRICHY" | "MADURAI";

export type ZoneCode =
  | "CHENNAI_WEST" | "CHENNAI_SOUTH" | "CHENNAI_CENTRAL" | "CHENNAI_NORTH" | "CHENNAI_NORTHWEST"
  | "COIMBATORE_CENTRAL" | "COIMBATORE_EAST" | "COIMBATORE_NORTH" | "COIMBATORE_SOUTH" | "COIMBATORE_WEST"
  | "TRICHY_CENTRAL" | "TRICHY_EAST" | "TRICHY_SOUTH" | "TRICHY_WEST" | "TRICHY_NORTH"
  | "MADURAI_CENTRAL" | "MADURAI_NORTH" | "MADURAI_SOUTH" | "MADURAI_EAST" | "MADURAI_WEST";

export type SchoolZone = { code: ZoneCode; name: string; localities: readonly string[] };
export type SchoolCity = {
  code: CityCode;
  name: string;
  aliases: readonly string[];
  latitude: number;
  longitude: number;
  zones: readonly SchoolZone[];
};

export const SCHOOL_CITIES: readonly SchoolCity[] = [
  {
    code: "CHENNAI", name: "Chennai", aliases: ["Chennai", "Madras"], latitude: 13.0827, longitude: 80.2707,
    zones: [
      { code: "CHENNAI_WEST", name: "West Chennai", localities: ["Porur", "Mugalivakkam", "Madhanandapuram", "Manapakkam", "Gerugambakkam", "Kolapakkam", "Moulivakkam", "Iyyappanthangal", "Kattupakkam", "Kovur", "Kundrathur", "Mangadu", "Valasaravakkam", "Ramapuram", "Vanagaram"] },
      { code: "CHENNAI_SOUTH", name: "South Chennai", localities: ["Adyar", "Velachery", "Thiruvanmiyur", "Guindy", "Pallikaranai", "Madipakkam", "Medavakkam", "Perungudi", "Thoraipakkam", "Sholinganallur"] },
      { code: "CHENNAI_CENTRAL", name: "Central Chennai", localities: ["T Nagar", "Nungambakkam", "Kodambakkam", "Ashok Nagar", "K K Nagar", "Saidapet", "Mylapore", "Alwarpet", "Kilpauk", "Egmore"] },
      { code: "CHENNAI_NORTH", name: "North Chennai", localities: ["Perambur", "Madhavaram", "Kolathur", "Tondiarpet", "Royapuram", "Washermanpet", "Tiruvottiyur", "Purasawalkam"] },
      { code: "CHENNAI_NORTHWEST", name: "North-West Chennai", localities: ["Anna Nagar", "Ambattur", "Mogappair", "Avadi", "Padi", "Korattur", "Nolambur", "Thirumullaivoyal"] },
    ],
  },
  {
    code: "COIMBATORE", name: "Coimbatore", aliases: ["Coimbatore", "Kovai"], latitude: 11.0168, longitude: 76.9558,
    zones: [
      { code: "COIMBATORE_CENTRAL", name: "Central Coimbatore", localities: ["RS Puram", "Gandhipuram", "Town Hall", "Race Course", "Ram Nagar"] },
      { code: "COIMBATORE_EAST", name: "East Coimbatore", localities: ["Peelamedu", "Singanallur", "Hope College", "Kalapatti", "Vilankurichi", "Neelambur"] },
      { code: "COIMBATORE_NORTH", name: "North Coimbatore", localities: ["Saibaba Colony", "Thudiyalur", "GN Mills", "Vadamadurai", "Koundampalayam"] },
      { code: "COIMBATORE_SOUTH", name: "South Coimbatore", localities: ["Podanur", "Sundarapuram", "Kuniyamuthur", "Eachanari", "Madukkarai"] },
      { code: "COIMBATORE_WEST", name: "West Coimbatore", localities: ["Vadavalli", "PN Pudur", "Veerakeralam", "Marudamalai", "Selvapuram"] },
    ],
  },
  {
    code: "TRICHY", name: "Trichy", aliases: ["Trichy", "Tiruchirappalli", "Tiruchirapalli"], latitude: 10.7905, longitude: 78.7047,
    zones: [
      { code: "TRICHY_CENTRAL", name: "Central Trichy", localities: ["Cantonment", "Thillai Nagar", "Tennur", "Woraiyur"] },
      { code: "TRICHY_EAST", name: "East Trichy", localities: ["Srirangam", "Thiruvanaikovil", "Kattur", "Ariyamangalam"] },
      { code: "TRICHY_SOUTH", name: "South Trichy", localities: ["KK Nagar", "Airport", "Edamalaipatti Pudur", "Crawford"] },
      { code: "TRICHY_WEST", name: "West Trichy", localities: ["Karumandapam", "Dheeran Nagar", "Vayalur Road", "Somarasampettai"] },
      { code: "TRICHY_NORTH", name: "North Trichy", localities: ["Samayapuram", "No.1 Tollgate", "Manachanallur", "Bikshandarkoil"] },
    ],
  },
  {
    code: "MADURAI", name: "Madurai", aliases: ["Madurai"], latitude: 9.9252, longitude: 78.1198,
    zones: [
      { code: "MADURAI_CENTRAL", name: "Central Madurai", localities: ["Anna Nagar", "KK Nagar", "Tallakulam", "Goripalayam", "Alwarpuram"] },
      { code: "MADURAI_NORTH", name: "North Madurai", localities: ["Iyer Bungalow", "Narayanapuram", "Oomachikulam", "Tiruppalai", "K Pudur"] },
      { code: "MADURAI_SOUTH", name: "South Madurai", localities: ["Tirupparankundram", "Avaniyapuram", "Villapuram", "Thiru Nagar"] },
      { code: "MADURAI_EAST", name: "East Madurai", localities: ["Mattuthavani", "Uthangudi", "Vandiyur", "Melamadai", "Karuppayurani"] },
      { code: "MADURAI_WEST", name: "West Madurai", localities: ["Kochadai", "Kalavasal", "Arasaradi", "Virattipathu", "Nagamalai Pudukottai"] },
    ],
  },
] as const;

export const CITY_BY_CODE = new Map(SCHOOL_CITIES.map((city) => [city.code, city]));
export const ZONE_BY_CODE = new Map(SCHOOL_CITIES.flatMap((city) => city.zones.map((zone) => [zone.code, { ...zone, city }] as const)));

export function normalizeLocationText(value: string) {
  return value.toLocaleLowerCase("en-IN").replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolveSchoolZone(input: { cityCode: CityCode; locality?: string | null; subLocality?: string | null; address?: string | null }) {
  const city = CITY_BY_CODE.get(input.cityCode);
  if (!city) return null;
  const haystack = normalizeLocationText([input.locality, input.subLocality, input.address].filter(Boolean).join(" "));
  const matches = city.zones.flatMap((zone) => zone.localities
    .filter((locality) => haystack.includes(normalizeLocationText(locality)))
    .map((locality) => ({ zone, locality, length: normalizeLocationText(locality).length })));
  matches.sort((left, right) => right.length - left.length);
  return matches[0] ? { zoneCode: matches[0].zone.code, zoneName: matches[0].zone.name, locality: matches[0].locality } : null;
}

export function cityFromAddress(address: string) {
  const normalized = normalizeLocationText(address);
  return SCHOOL_CITIES.find((city) => city.aliases.some((alias) => normalized.includes(normalizeLocationText(alias)))) || null;
}
