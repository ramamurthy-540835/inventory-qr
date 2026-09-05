import { logInfo, logWarning } from "@/lib/logging";
import { deduplicateSchools, normalizeSchoolName, rankSchools } from "@/lib/school-locator/normalization";
import { ProviderError } from "@/lib/school-locator/provider-utils";
import { CITY_BY_CODE, ZONE_BY_CODE } from "@/lib/school-locator/territories";
import type {
  SchoolAnalytics, SchoolDirectoryRepository, SchoolSearchParams, SchoolSearchProvider, SchoolSearchResponse, SchoolSearchResult,
} from "@/lib/school-locator/types";

export class SchoolSearchValidationError extends Error {
  constructor(message: string) { super(message); this.name = "SchoolSearchValidationError"; }
}

type LocatorDependencies = {
  repository: SchoolDirectoryRepository;
  google: SchoolSearchProvider;
  serpapi: SchoolSearchProvider;
  analytics: SchoolAnalytics;
  defer?: (task: () => Promise<void>) => void;
};

const MIN_GOOD_RESULTS = 5;

function hasEnoughResults(results: SchoolSearchResult[], query: string) {
  const normalized = normalizeSchoolName(query);
  return results.length >= MIN_GOOD_RESULTS
    || results.some((school) => school.normalized_name.startsWith(normalized) && school.confidence >= 0.8);
}

export class PrivateSchoolLocatorAgent {
  private readonly inflight = new Map<string, Promise<SchoolSearchResponse>>();
  private readonly defer: (task: () => Promise<void>) => void;

  constructor(private readonly dependencies: LocatorDependencies) {
    this.defer = dependencies.defer || ((task) => queueMicrotask(() => void task().catch((error) => logWarning("school.analytics_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }))));
  }

  search(input: SchoolSearchParams) {
    const params = this.validate(input);
    const key = `${params.cityCode}:${params.cityWide ? "ALL" : params.zoneCode}:${params.query}:${params.limit}`;
    const active = this.inflight.get(key);
    if (active) return active;
    const request = this.run(params).finally(() => this.inflight.delete(key));
    this.inflight.set(key, request);
    return request;
  }

  private validate(input: SchoolSearchParams): SchoolSearchParams {
    const query = normalizeSchoolName(input.query).slice(0, 80);
    if (query.length < 3) throw new SchoolSearchValidationError("Enter at least three characters of the school name.");
    const city = CITY_BY_CODE.get(input.cityCode);
    const zone = ZONE_BY_CODE.get(input.zoneCode);
    if (!city) throw new SchoolSearchValidationError("Choose a supported city.");
    if (!zone || zone.city.code !== city.code) throw new SchoolSearchValidationError("Choose a zone in the selected city.");
    return { ...input, query, limit: Math.max(1, Math.min(Number(input.limit) || 10, 10)), cityWide: Boolean(input.cityWide) };
  }

  private async run(params: SchoolSearchParams): Promise<SchoolSearchResponse> {
    const startedAt = Date.now();
    const city = CITY_BY_CODE.get(params.cityCode)!;
    const zone = ZONE_BY_CODE.get(params.zoneCode)!;
    logInfo("school_search_started", { city: params.cityCode, zone: params.zoneCode, query_length: params.query.length });

    let local = await this.dependencies.repository.search(params).catch((error) => {
      logWarning("school_directory_read_failed", { city: params.cityCode, zone: params.zoneCode, errorName: error instanceof Error ? error.name : "UnknownError" });
      return [];
    });
    local = this.matching(rankSchools(deduplicateSchools(local), params.query, params.zoneCode), params);
    if (hasEnoughResults(local, params.query)) return this.finish(params, local, "firestore", false, startedAt);

    const cached = await this.dependencies.repository.getCached(params).catch(() => null);
    if (cached) {
      logInfo("school_cache_hit", { city: params.cityCode, zone: params.zoneCode, query_length: params.query.length, result_count: cached.schools.length });
      const results = this.matching(rankSchools(deduplicateSchools([...local, ...cached.schools]), params.query, params.zoneCode), params).slice(0, params.limit);
      if (results.length) return this.finish(params, results, `cache+${cached.providerUsed}`, true, startedAt);
    }
    logInfo("school_cache_miss", { city: params.cityCode, zone: params.zoneCode, query_length: params.query.length });

    const providerParams = { ...params, cityName: city.name, zoneName: zone.name, localities: zone.localities };
    const providerNames: string[] = [];
    const external: SchoolSearchResult[] = [];

    if (!hasEnoughResults(local, params.query)) {
      const googleStarted = Date.now();
      try {
        logInfo("google_places_called", { city: params.cityCode, zone: params.zoneCode, query_length: params.query.length });
        const google = await this.dependencies.google.searchSchools(providerParams);
        external.push(...google);
        providerNames.push("google");
        this.background(() => this.dependencies.analytics.recordProviderUsage("google", true, Date.now() - googleStarted, google.length));
      } catch (error) {
        logWarning("google_places_failed", { city: params.cityCode, zone: params.zoneCode, errorName: error instanceof Error ? error.name : "UnknownError", provider_status: error instanceof ProviderError ? error.status || 0 : 0 });
        this.background(() => this.dependencies.analytics.recordProviderUsage("google", false, Date.now() - googleStarted, 0));
      }
    }

    let combined = this.matching(rankSchools(deduplicateSchools([...local, ...external]), params.query, params.zoneCode), params);
    if (!hasEnoughResults(combined, params.query)) {
      const serpStarted = Date.now();
      try {
        logInfo("serpapi_called", { city: params.cityCode, zone: params.zoneCode, query_length: params.query.length });
        const serp = await this.dependencies.serpapi.searchSchools(providerParams);
        external.push(...serp);
        providerNames.push("serpapi");
        this.background(() => this.dependencies.analytics.recordProviderUsage("serpapi", true, Date.now() - serpStarted, serp.length));
      } catch (error) {
        logWarning("serpapi_failed", { city: params.cityCode, zone: params.zoneCode, errorName: error instanceof Error ? error.name : "UnknownError", provider_status: error instanceof ProviderError ? error.status || 0 : 0 });
        this.background(() => this.dependencies.analytics.recordProviderUsage("serpapi", false, Date.now() - serpStarted, 0));
      }
    }

    combined = this.matching(rankSchools(deduplicateSchools([...local, ...external]), params.query, params.zoneCode), params).slice(0, params.limit);
    const externalResults = combined.filter((school) => school.provider !== "manual" && !local.some((entry) => entry.id === school.id));
    if (externalResults.length) {
      await this.dependencies.repository.saveMany(externalResults).catch((error) => logWarning("school_directory_write_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }));
      this.background(() => this.dependencies.analytics.recordSchools(externalResults));
    }
    const source = providerNames.length ? providerNames.join("+") : "firestore";
    if (combined.length) await this.dependencies.repository.setCached(params, combined, source).catch(() => undefined);
    return this.finish(params, combined, source, false, startedAt);
  }

  private matching(schools: SchoolSearchResult[], params: SchoolSearchParams) {
    const normalized = normalizeSchoolName(params.query);
    return schools.filter((school) => school.city_code === params.cityCode && school.normalized_name.includes(normalized))
      .map((school) => ({ ...school, outside_selected_zone: (school.zone_resolution !== "locality" && school.provider !== "manual") || school.zone_code !== params.zoneCode }));
  }

  private finish(params: SchoolSearchParams, schools: ReturnType<typeof deduplicateSchools>, source: string, cacheHit: boolean, startedAt: number) {
    const results = schools.slice(0, params.limit);
    const meta = {
      count: results.length, source, cache_hit: cacheHit, provider_used: source,
      latency_ms: Date.now() - startedAt, manual_available: results.length === 0, city_wide: Boolean(params.cityWide),
    };
    logInfo("school_results_returned", { city: params.cityCode, zone: params.zoneCode, result_count: results.length, provider: source, latency_ms: meta.latency_ms });
    this.background(() => this.dependencies.analytics.recordSearch(params, meta));
    return { results, meta };
  }

  private background(task: () => Promise<void>) {
    this.defer(async () => { try { await task(); } catch (error) { logWarning("school_analytics_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }); } });
  }
}
