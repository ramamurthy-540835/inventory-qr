import type { CityCode, ZoneCode } from "@/lib/school-locator/territories";

export type SchoolProvider = "google" | "serpapi" | "manual";
export type PrivateStatus = "verified" | "likely" | "unverified";

export type SchoolSearchResult = {
  id: string;
  school_name: string;
  normalized_name: string;
  formatted_address: string;
  locality: string;
  sub_locality: string | null;
  zone_code: ZoneCode;
  zone_name: string;
  city_code: CityCode;
  city_name: string;
  state: "Tamil Nadu";
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: SchoolProvider;
  provider_place_id: string | null;
  school_type: string | null;
  school_board: string | null;
  private_status: PrivateStatus;
  confidence: number;
  is_active: boolean;
  search_keywords: string[];
  outside_selected_zone?: boolean;
  zone_resolution?: "locality" | "search_context";
  board?: string | null;
  classes_from?: string | null;
  classes_to?: string | null;
  student_strength_total?: number | null;
  student_strength_6_12?: number | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  principal_name?: string | null;
  school_management_type?: string | null;
  estimated_lunch_students?: number | null;
  franchise_id?: string | null;
  territory_id?: string | null;
  territory_manager?: string | null;
};

export type SchoolSearchParams = { cityCode: CityCode; zoneCode: ZoneCode; query: string; limit: number; cityWide?: boolean };
export type ProviderSearchParams = SchoolSearchParams & { cityName: string; zoneName: string; localities: readonly string[] };

export interface SchoolSearchProvider {
  readonly name: "google" | "serpapi";
  searchSchools(params: ProviderSearchParams): Promise<SchoolSearchResult[]>;
  getSchoolDetails(id: string): Promise<SchoolSearchResult | null>;
}

export interface SchoolDirectoryRepository {
  search(params: SchoolSearchParams): Promise<SchoolSearchResult[]>;
  getByIds(ids: string[]): Promise<SchoolSearchResult[]>;
  getById(id: string): Promise<SchoolSearchResult | null>;
  saveMany(schools: SchoolSearchResult[]): Promise<void>;
  saveManual(school: SchoolSearchResult): Promise<void>;
  getCached(params: SchoolSearchParams): Promise<{ schools: SchoolSearchResult[]; providerUsed: string } | null>;
  setCached(params: SchoolSearchParams, schools: SchoolSearchResult[], providerUsed: string): Promise<void>;
}

export type SchoolSearchMeta = {
  count: number;
  source: string;
  cache_hit: boolean;
  provider_used: string;
  latency_ms: number;
  manual_available: boolean;
  city_wide: boolean;
};

export type SchoolSearchResponse = { results: SchoolSearchResult[]; meta: SchoolSearchMeta };

export interface SchoolAnalytics {
  recordSearch(params: SchoolSearchParams, meta: SchoolSearchMeta): Promise<void>;
  recordSchools(schools: SchoolSearchResult[]): Promise<void>;
  recordRegistration(school: SchoolSearchResult, source: string): Promise<void>;
  recordProviderUsage(provider: string, success: boolean, latencyMs: number, resultCount: number): Promise<void>;
}
