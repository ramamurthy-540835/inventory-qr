import { BigQuery } from "@google-cloud/bigquery";
import type { SchoolAnalytics, SchoolSearchMeta, SchoolSearchParams, SchoolSearchResult } from "@/lib/school-locator/types";

function client() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "chennaifood";
  const configured = process.env.SCHOOL_DIRECTORY_BIGQUERY_DATASET || process.env.BIGQUERY_DATASET;
  const datasetId = configured === "school_directory" ? configured : "school_directory";
  return { projectId, datasetId, location: process.env.BIGQUERY_LOCATION || "asia-south1", bigquery: new BigQuery({ projectId }) };
}

export class BigQuerySchoolAnalytics implements SchoolAnalytics {
  async recordSearch(params: SchoolSearchParams, meta: SchoolSearchMeta) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table("school_search_events").insert([{
      event_timestamp: new Date(), city_code: params.cityCode, zone_code: params.cityWide ? null : params.zoneCode,
      query_prefix: params.query.slice(0, 12).toLocaleLowerCase("en-IN"), result_count: meta.count,
      provider_used: meta.provider_used, cache_hit: meta.cache_hit, latency_ms: meta.latency_ms,
    }]);
  }

  async recordSchools(schools: SchoolSearchResult[]) {
    if (!schools.length) return;
    const { bigquery, projectId, datasetId, location } = client();
    await bigquery.query({ location, params: { payload: JSON.stringify(schools) }, query: `
      MERGE \`${projectId}.${datasetId}.school_master\` T
      USING (SELECT
        JSON_VALUE(item, '$.id') school_id, JSON_VALUE(item, '$.school_name') school_name,
        JSON_VALUE(item, '$.city_code') city_code, JSON_VALUE(item, '$.zone_code') zone_code,
        JSON_VALUE(item, '$.locality') locality, JSON_VALUE(item, '$.postal_code') postal_code,
        SAFE_CAST(JSON_VALUE(item, '$.latitude') AS FLOAT64) latitude,
        SAFE_CAST(JSON_VALUE(item, '$.longitude') AS FLOAT64) longitude,
        JSON_VALUE(item, '$.provider') provider, JSON_VALUE(item, '$.private_status') private_status,
        SAFE_CAST(JSON_VALUE(item, '$.confidence') AS FLOAT64) confidence,
        JSON_VALUE(item, '$.school_board') school_board
      FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@payload))) item) S
      ON T.school_id=S.school_id
      WHEN MATCHED THEN UPDATE SET school_name=S.school_name,city_code=S.city_code,zone_code=S.zone_code,locality=S.locality,postal_code=S.postal_code,latitude=S.latitude,longitude=S.longitude,provider=S.provider,private_status=S.private_status,confidence=S.confidence,school_board=S.school_board,last_verified_at=CURRENT_TIMESTAMP(),updated_at=CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (school_id,school_name,city_code,zone_code,locality,postal_code,latitude,longitude,provider,private_status,confidence,school_board,last_verified_at,created_at,updated_at) VALUES (S.school_id,S.school_name,S.city_code,S.zone_code,S.locality,S.postal_code,S.latitude,S.longitude,S.provider,S.private_status,S.confidence,S.school_board,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())` });
  }

  async recordRegistration(school: SchoolSearchResult, source: string) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table("school_registration_events").insert([{
      event_timestamp: new Date(), school_id: school.id, city_code: school.city_code,
      zone_code: school.zone_code, registration_source: source,
    }]);
  }

  async recordProviderUsage(provider: string, success: boolean, latencyMs: number, resultCount: number) {
    const { bigquery, datasetId } = client();
    await bigquery.dataset(datasetId).table("school_provider_usage").insert([{
      event_timestamp: new Date(), provider, success, latency_ms: latencyMs, result_count: resultCount,
    }]);
  }
}
