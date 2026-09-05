import { deduplicateEntities, isRelevantEntity, normalizeEntityName, rankEntities } from "@/lib/entity-locator/normalization";
import type { EntityAnalytics, EntityDirectoryRepository, EntitySearchParams, EntitySearchResponse, LocationEntityResult, LocationEntitySearchProvider } from "@/lib/entity-locator/types";
import { logInfo, logWarning } from "@/lib/logging";
import { ProviderError } from "@/lib/school-locator/provider-utils";
import { CITY_BY_CODE, ZONE_BY_CODE } from "@/lib/school-locator/territories";

export class EntitySearchValidationError extends Error {
  constructor(message: string) { super(message); this.name = "EntitySearchValidationError"; }
}

type Dependencies = { repository: EntityDirectoryRepository; google: LocationEntitySearchProvider; serpapi: LocationEntitySearchProvider; analytics: EntityAnalytics; defer?: (task: () => Promise<void>) => void };
const MIN_GOOD_RESULTS = 5;
function hasEnough(results: LocationEntityResult[], query: string) {
  const normalized = normalizeEntityName(query);
  return results.length >= MIN_GOOD_RESULTS || results.some((entity) => entity.normalized_name.startsWith(normalized) && entity.confidence >= 0.8);
}

export class LocationEntitySearchService {
  private readonly inflight = new Map<string, Promise<EntitySearchResponse>>();
  private readonly defer: (task: () => Promise<void>) => void;
  constructor(private readonly dependencies: Dependencies) {
    this.defer = dependencies.defer || ((task) => queueMicrotask(() => void task().catch(() => undefined)));
  }

  search(input: EntitySearchParams) {
    const params = this.validate(input);
    const key = `${params.entityType}:${params.cityCode}:${params.cityWide ? "ALL" : params.zoneCode}:${params.query}:${params.limit}`;
    const active = this.inflight.get(key);
    if (active) return active;
    const request = this.run(params).finally(() => this.inflight.delete(key));
    this.inflight.set(key, request);
    return request;
  }

  private validate(input: EntitySearchParams): EntitySearchParams {
    const query = normalizeEntityName(input.query).slice(0, 80);
    if (query.length < 3) throw new EntitySearchValidationError(`Enter at least three characters of the ${input.entityType} name.`);
    const city = CITY_BY_CODE.get(input.cityCode);
    const zone = ZONE_BY_CODE.get(input.zoneCode);
    if (!city) throw new EntitySearchValidationError("Choose a supported city.");
    if (!zone || zone.city.code !== city.code) throw new EntitySearchValidationError("Choose a zone in the selected city.");
    return { ...input, query, limit: Math.max(1, Math.min(Number(input.limit) || 10, 10)), cityWide: Boolean(input.cityWide) };
  }

  private matching(entities: LocationEntityResult[], params: EntitySearchParams) {
    const normalized = normalizeEntityName(params.query);
    return entities.filter((entity) => entity.entity_type === params.entityType && entity.city_code === params.cityCode
      && entity.normalized_name.includes(normalized) && isRelevantEntity(params.entityType, entity.display_name, entity.category ? [entity.category] : []))
      .map((entity) => ({ ...entity, outside_selected_zone: (entity.zone_resolution !== "locality" && entity.provider !== "manual") || entity.zone_code !== params.zoneCode }));
  }

  private async run(params: EntitySearchParams): Promise<EntitySearchResponse> {
    const startedAt = Date.now();
    const city = CITY_BY_CODE.get(params.cityCode)!;
    const zone = ZONE_BY_CODE.get(params.zoneCode)!;
    logInfo("entity_search_started", { entity_type: params.entityType, city: params.cityCode, zone: params.zoneCode, query_length: params.query.length });
    let local = await this.dependencies.repository.search(params).catch((error) => {
      logWarning("entity_directory_read_failed", { entity_type: params.entityType, city: params.cityCode, errorName: error instanceof Error ? error.name : "UnknownError" }); return [];
    });
    local = this.matching(rankEntities(deduplicateEntities(local), params.query, params.zoneCode), params);
    if (hasEnough(local, params.query)) return this.finish(params, local, "firestore", false, startedAt);
    const cached = await this.dependencies.repository.getCached(params).catch(() => null);
    if (cached) {
      const results = this.matching(rankEntities(deduplicateEntities([...local, ...cached.entities]), params.query, params.zoneCode), params).slice(0, params.limit);
      if (results.length) return this.finish(params, results, `cache+${cached.providerUsed}`, true, startedAt);
    }
    const providerParams = { ...params, cityName: city.name, zoneName: zone.name, localities: zone.localities };
    const external: LocationEntityResult[] = [];
    const providers: string[] = [];
    for (const provider of [this.dependencies.google, this.dependencies.serpapi]) {
      const combined = this.matching(rankEntities(deduplicateEntities([...local, ...external]), params.query, params.zoneCode), params);
      if (hasEnough(combined, params.query)) break;
      const providerStarted = Date.now();
      try {
        const found = await provider.search(providerParams);
        external.push(...found); providers.push(provider.name);
        this.background(() => this.dependencies.analytics.recordProviderUsage(params.entityType, provider.name, true, Date.now() - providerStarted, found.length));
      } catch (error) {
        logWarning("entity_provider_failed", { entity_type: params.entityType, provider: provider.name, city: params.cityCode, errorName: error instanceof Error ? error.name : "UnknownError", provider_status: error instanceof ProviderError ? error.status || 0 : 0 });
        this.background(() => this.dependencies.analytics.recordProviderUsage(params.entityType, provider.name, false, Date.now() - providerStarted, 0));
      }
    }
    const combined = this.matching(rankEntities(deduplicateEntities([...local, ...external]), params.query, params.zoneCode), params).slice(0, params.limit);
    const newEntities = combined.filter((entity) => entity.provider !== "manual" && !local.some((entry) => entry.id === entity.id));
    if (newEntities.length) {
      await this.dependencies.repository.saveMany(params.entityType, newEntities).catch((error) => logWarning("entity_directory_write_failed", { entity_type: params.entityType, errorName: error instanceof Error ? error.name : "UnknownError" }));
      this.background(() => this.dependencies.analytics.recordEntities(params.entityType, newEntities));
    }
    const source = providers.length ? providers.join("+") : "firestore";
    if (combined.length) await this.dependencies.repository.setCached(params, combined, source).catch(() => undefined);
    return this.finish(params, combined, source, false, startedAt);
  }

  private finish(params: EntitySearchParams, entities: LocationEntityResult[], source: string, cacheHit: boolean, startedAt: number) {
    const results = entities.slice(0, params.limit);
    const meta = { count: results.length, source, cache_hit: cacheHit, provider_used: source, latency_ms: Date.now() - startedAt, manual_available: results.length === 0, city_wide: Boolean(params.cityWide) };
    logInfo("entity_results_returned", { entity_type: params.entityType, city: params.cityCode, zone: params.zoneCode, result_count: results.length, provider: source, latency_ms: meta.latency_ms });
    this.background(() => this.dependencies.analytics.recordSearch(params, meta));
    return { results, meta };
  }

  private background(task: () => Promise<void>) {
    this.defer(async () => { try { await task(); } catch (error) { logWarning("entity_analytics_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }); } });
  }
}
