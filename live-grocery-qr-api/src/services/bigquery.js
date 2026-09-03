import { BigQuery } from '@google-cloud/bigquery';
const dataset = process.env.BIGQUERY_DATASET;
const projectId = process.env.GCP_PROJECT_ID;
export async function streamEvent(event) {
  if (!dataset || !projectId) return;
  const bq = new BigQuery({ projectId });
  await bq.dataset(dataset).table('delivery_events_analytics').insert([{ ...event, timestamp: new Date().toISOString() }]);
}
