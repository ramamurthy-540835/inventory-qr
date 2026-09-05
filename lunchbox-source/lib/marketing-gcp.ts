import { BigQuery } from "@google-cloud/bigquery";
import type { MarketingLead } from "@/lib/marketing";

const projectId = process.env.GCP_PROJECT_ID;
const datasetId = process.env.BIGQUERY_DATASET || "school_lunch";
const locationsTable = process.env.BIGQUERY_MARKETING_LOCATIONS_TABLE || "marketing_locations";
const searchesTable = process.env.BIGQUERY_MARKETING_SEARCHES_TABLE || "marketing_discovery_runs";

function client() {
  return projectId ? new BigQuery({ projectId }) : null;
}

export async function recordDiscovery(input: {
  searchId: string;
  school: MarketingLead;
  radiusKm: number;
  communities: MarketingLead[];
}) {
  const bigquery = client();
  if (!bigquery) return "demo" as const;
  await bigquery.dataset(datasetId).table(searchesTable).insert([{
    search_id: input.searchId,
    searched_at: new Date().toISOString(),
    school_place_id: input.school.placeId || input.school.id,
    school_name: input.school.name,
    school_latitude: input.school.latitude,
    school_longitude: input.school.longitude,
    radius_km: input.radiusKm,
    result_count: input.communities.length,
  }]);
  return "gcp" as const;
}

export async function saveMarketingLocation(lead: MarketingLead, schoolPlaceId?: string) {
  const bigquery = client();
  if (!bigquery) return "demo" as const;
  await bigquery.dataset(datasetId).table(locationsTable).insert([{
    location_id: lead.placeId || lead.id,
    place_id: lead.placeId || null,
    name: lead.name,
    location_type: lead.audience,
    address: lead.address,
    city: lead.city,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    phone: lead.phone || null,
    website: lead.website || null,
    rating: lead.rating ?? null,
    reviews: lead.reviews ?? null,
    related_school_place_id: schoolPlaceId || null,
    distance_km: lead.distanceKm ?? null,
    status: "New",
    saved_at: new Date().toISOString(),
  }], { skipInvalidRows: false, ignoreUnknownValues: false });
  return "gcp" as const;
}
