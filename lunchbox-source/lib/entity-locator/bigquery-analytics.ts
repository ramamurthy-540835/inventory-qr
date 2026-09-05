import { BigQuery } from "@google-cloud/bigquery";
import type { EntityAnalytics, EntitySearchMeta, EntitySearchParams, EntityType, LocationEntityResult } from "@/lib/entity-locator/types";

function client() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "chennaifood";
  const datasetId = "school_directory";
  return { projectId, datasetId, location: process.env.BIGQUERY_LOCATION || "asia-south1", bigquery: new BigQuery({ projectId }) };
}

export class BigQueryEntityAnalytics implements EntityAnalytics {
  async recordSearch(params: EntitySearchParams, meta: EntitySearchMeta) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table("entity_search_events").insert([{
      event_timestamp: new Date(), entity_type: params.entityType, city_code: params.cityCode,
      zone_code: params.cityWide ? null : params.zoneCode, query_prefix: params.query.slice(0, 12), result_count: meta.count,
      provider_used: meta.provider_used, cache_hit: meta.cache_hit, latency_ms: meta.latency_ms,
    }]);
  }

  async recordEntities(entityType: EntityType, entities: LocationEntityResult[]) {
    if (!entities.length) return;
    const { bigquery, projectId, datasetId, location } = client();
    const table = `${entityType}_master`;
    const idColumn = `${entityType}_id`;
    const relationshipUpdate = entityType === "office" ? ",company_id=S.company_id" : "";
    const relationshipColumn = entityType === "office" ? ",company_id" : "";
    const relationshipValue = entityType === "office" ? ",S.company_id" : "";
    await bigquery.query({ location, params: { payload: JSON.stringify(entities) }, query: `
      MERGE \`${projectId}.${datasetId}.${table}\` T
      USING (SELECT JSON_VALUE(item, '$.id') entity_id, JSON_VALUE(item, '$.display_name') display_name,
        JSON_VALUE(item, '$.formatted_address') formatted_address, JSON_VALUE(item, '$.city_code') city_code,
        JSON_VALUE(item, '$.zone_code') zone_code, JSON_VALUE(item, '$.locality') locality,
        JSON_VALUE(item, '$.postal_code') postal_code, SAFE_CAST(JSON_VALUE(item, '$.latitude') AS FLOAT64) latitude,
        SAFE_CAST(JSON_VALUE(item, '$.longitude') AS FLOAT64) longitude, JSON_VALUE(item, '$.provider') provider,
        JSON_VALUE(item, '$.verification_status') verification_status, SAFE_CAST(JSON_VALUE(item, '$.confidence') AS FLOAT64) confidence,
        JSON_VALUE(item, '$.category') category, JSON_VALUE(item, '$.company_id') company_id
       FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@payload))) item) S
      ON T.${idColumn}=S.entity_id
      WHEN MATCHED THEN UPDATE SET display_name=S.display_name,formatted_address=S.formatted_address,city_code=S.city_code,zone_code=S.zone_code,locality=S.locality,postal_code=S.postal_code,latitude=S.latitude,longitude=S.longitude,provider=S.provider,verification_status=S.verification_status,confidence=S.confidence,category=S.category${relationshipUpdate},updated_at=CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (${idColumn},display_name,formatted_address,city_code,zone_code,locality,postal_code,latitude,longitude,provider,verification_status,confidence,category${relationshipColumn},created_at,updated_at) VALUES (S.entity_id,S.display_name,S.formatted_address,S.city_code,S.zone_code,S.locality,S.postal_code,S.latitude,S.longitude,S.provider,S.verification_status,S.confidence,S.category${relationshipValue},CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())` });
  }

  async recordRegistration(entity: LocationEntityResult, source: string) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table(`${entity.entity_type}_registration_events`).insert([{
      event_timestamp: new Date(), [`${entity.entity_type}_id`]: entity.id, city_code: entity.city_code,
      zone_code: entity.zone_code, registration_source: source,
    }]);
  }

  async recordProviderUsage(entityType: EntityType, provider: string, success: boolean, latencyMs: number, resultCount: number) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table("entity_provider_usage").insert([{
      event_timestamp: new Date(), entity_type: entityType, provider, success, latency_ms: latencyMs, result_count: resultCount,
    }]);
  }
}
