import type { CityCode, ZoneCode } from "@/lib/school-locator/territories";

export type EntityType = "office" | "company" | "college";
export type EntityProvider = "google" | "serpapi" | "manual";
export type VerificationStatus = "verified_external" | "likely" | "unverified";

export type LocationEntityResult = {
  id: string;
  entity_type: EntityType;
  display_name: string;
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
  provider: EntityProvider;
  provider_place_id: string | null;
  category: string | null;
  verification_status: VerificationStatus;
  confidence: number;
  is_active: boolean;
  search_keywords: string[];
  outside_selected_zone?: boolean;
  zone_resolution?: "locality" | "search_context";
  company_id?: string | null;
  legal_name?: string | null;
  company_type?: string | null;
  industry?: string | null;
  primary_office_id?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  cin?: string | null;
  employee_strength?: number | null;
  student_strength?: number | null;
};

export type EntitySearchParams = {
  entityType: EntityType;
  cityCode: CityCode;
  zoneCode: ZoneCode;
  query: string;
  limit: number;
  cityWide?: boolean;
};

export type EntityProviderSearchParams = EntitySearchParams & {
  cityName: string;
  zoneName: string;
  localities: readonly string[];
};

export interface LocationEntitySearchProvider {
  readonly name: "google" | "serpapi";
  search(params: EntityProviderSearchParams): Promise<LocationEntityResult[]>;
}

export interface EntityDirectoryRepository {
  search(params: EntitySearchParams): Promise<LocationEntityResult[]>;
  getByIds(entityType: EntityType, ids: string[]): Promise<LocationEntityResult[]>;
  getById(entityType: EntityType, id: string): Promise<LocationEntityResult | null>;
  saveMany(entityType: EntityType, entities: LocationEntityResult[]): Promise<void>;
  getCached(params: EntitySearchParams): Promise<{ entities: LocationEntityResult[]; providerUsed: string } | null>;
  setCached(params: EntitySearchParams, entities: LocationEntityResult[], providerUsed: string): Promise<void>;
}

export type EntitySearchMeta = {
  count: number;
  source: string;
  cache_hit: boolean;
  provider_used: string;
  latency_ms: number;
  manual_available: boolean;
  city_wide: boolean;
};

export interface EntityAnalytics {
  recordSearch(params: EntitySearchParams, meta: EntitySearchMeta): Promise<void>;
  recordEntities(entityType: EntityType, entities: LocationEntityResult[]): Promise<void>;
  recordRegistration(entity: LocationEntityResult, source: string): Promise<void>;
  recordProviderUsage(entityType: EntityType, provider: string, success: boolean, latencyMs: number, resultCount: number): Promise<void>;
}

export type EntitySearchResponse = { results: LocationEntityResult[]; meta: EntitySearchMeta };
