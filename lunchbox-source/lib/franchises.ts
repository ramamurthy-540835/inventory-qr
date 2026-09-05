import { Storage } from "@google-cloud/storage";
import { firestoreClient } from "@/lib/firestore";

export type Franchise = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  imageUrl: string;
  category: string;
  companyName: string;
  area: string;
  website: string;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  studentCount: number;
  location: { lat: number; lng: number } | null;
};

type FranchiseFilters = { area?: string; category?: string; search?: string; limit?: number };
type StorageFile = ReturnType<ReturnType<Storage["bucket"]>["file"]>;

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function numberOrNull(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function idFrom(value: Record<string, unknown>, index: number) {
  const explicit = text(value.id);
  if (explicit) return explicit;
  const generated = [text(value.name), text(value.area), text(value.address)].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return generated || `franchise-${index + 1}`;
}

function franchiseFrom(id: string, value: Record<string, unknown>): Franchise {
  return {
    id, name: text(value.name), city: text(value.city) || "Chennai", address: text(value.address), phone: text(value.phone), email: text(value.email),
    description: text(value.description), imageUrl: text(value.imageUrl), category: text(value.category), companyName: text(value.companyName), area: text(value.area),
    website: text(value.website), rating: numberOrNull(value.rating), reviews: numberOrNull(value.reviews), mapsUrl: text(value.mapsUrl), sourceUrl: text(value.sourceUrl),
    lastVerifiedAt: text(value.lastVerifiedAt), studentCount: Math.max(0, Number(value.studentCount) || 0), location: value.location && typeof value.location === "object" && typeof (value.location as { lat?: unknown }).lat === "number" && typeof (value.location as { lng?: unknown }).lng === "number" ? value.location as { lat: number; lng: number } : null,
  };
}

function activeStorageRecords(payload: unknown) {
  const values = Array.isArray(payload) ? payload : record(payload) && Array.isArray(payload.franchises) ? payload.franchises : record(payload) ? [payload] : [];
  return values.filter(record).filter((value) => value.active !== false && text(value.status).toLowerCase() !== "inactive");
}

async function downloadJson(file: StorageFile) {
  const [contents] = await file.download();
  return JSON.parse(contents.toString("utf8")) as unknown;
}

async function getStorageFranchises(): Promise<Franchise[] | null> {
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const bucketName = process.env.GCS_BUCKET?.trim();
  if (!projectId || !bucketName) return null;

  const bucket = new Storage({ projectId }).bucket(bucketName);
  const configuredObject = process.env.GCS_FRANCHISES_OBJECT?.trim();
  if (configuredObject) {
    const payload = await downloadJson(bucket.file(configuredObject));
    return activeStorageRecords(payload).map((value, index) => franchiseFrom(idFrom(value, index), value));
  }

  try {
    const payload = await downloadJson(bucket.file("franchises.json"));
    return activeStorageRecords(payload).map((value, index) => franchiseFrom(idFrom(value, index), value));
  } catch (error) {
    if ((error as { code?: number }).code !== 404) throw error;
  }

  const prefix = process.env.GCS_FRANCHISES_PREFIX?.trim() || "franchises/";
  const [files] = await bucket.getFiles({ prefix, maxResults: 1000, autoPaginate: false });
  const jsonFiles = files.filter((file) => file.name.endsWith(".json"));
  const values: Record<string, unknown>[] = [];
  for (let start = 0; start < jsonFiles.length; start += 20) {
    const payloads = await Promise.all(jsonFiles.slice(start, start + 20).map(downloadJson));
    payloads.forEach((payload) => values.push(...activeStorageRecords(payload)));
  }
  return values.map((value, index) => franchiseFrom(idFrom(value, index), value));
}

function normalizedLimit(value: number | undefined) {
  const requested = Number.isFinite(value) ? Math.trunc(value as number) : 1000;
  return Math.min(Math.max(requested, 1), 1000);
}

function applyFilters(records: Franchise[], filters: FranchiseFilters) {
  const term = filters.search?.trim().toLowerCase();
  return records
    .filter((item) => (!filters.area || item.area === filters.area) && (!filters.category || item.category === filters.category) && (!term || [item.name, item.companyName, item.area, item.category].join(" ").toLowerCase().includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, normalizedLimit(filters.limit));
}

export async function getFranchises(filters: FranchiseFilters = {}) {
  let firestoreError: unknown;
  try {
    const snapshot = await firestoreClient().collection("franchises").where("status", "==", "active").limit(normalizedLimit(filters.limit)).get();
    const records = snapshot.docs.map((document) => franchiseFrom(document.id, document.data()));
    if (records.length) return { franchises: applyFilters(records, filters), source: "firestore" as const };
  } catch (error) {
    firestoreError = error;
  }

  const storageRecords = await getStorageFranchises();
  if (storageRecords?.length || !firestoreError) return { franchises: applyFilters(storageRecords || [], filters), source: storageRecords ? "gcs" as const : "firestore" as const };
  throw firestoreError;
}

export async function getFranchise(id: string) {
  let firestoreError: unknown;
  try {
    const document = await firestoreClient().collection("franchises").doc(id).get();
    if (document.exists) return franchiseFrom(document.id, document.data() || {});
  } catch (error) {
    firestoreError = error;
  }

  const storageRecords = await getStorageFranchises();
  const match = storageRecords?.find((item) => item.id === id) || null;
  if (match || !firestoreError) return match;
  throw firestoreError;
}

export function externalUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; } catch { return ""; }
}
