import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { firestoreClient } from "@/lib/firestore";
import { normalizeSchoolName } from "@/lib/school-locator/normalization";
import type { SchoolDirectoryRepository, SchoolSearchParams, SchoolSearchResult } from "@/lib/school-locator/types";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function cacheId(params: SchoolSearchParams) {
  const key = `${params.cityCode}:${params.cityWide ? "ALL" : params.zoneCode}:${normalizeSchoolName(params.query)}`;
  return createHash("sha256").update(key).digest("hex");
}

function schoolData(school: SchoolSearchResult) {
  return {
    ...school,
    outside_selected_zone: FieldValue.delete(),
    updated_at: FieldValue.serverTimestamp(),
    last_verified_at: FieldValue.serverTimestamp(),
  };
}

function fromDocument(id: string, data: Record<string, unknown>): SchoolSearchResult {
  const clean = { ...data };
  delete clean.created_at;
  delete clean.updated_at;
  delete clean.last_verified_at;
  return {
    ...(clean as Omit<SchoolSearchResult, "id">),
    id,
    outside_selected_zone: Boolean(clean.outside_selected_zone),
  };
}

export class FirestoreSchoolDirectory implements SchoolDirectoryRepository {
  async search(params: SchoolSearchParams) {
    const keyword = normalizeSchoolName(params.query);
    if (keyword.length < 3) return [];
    const snapshot = await firestoreClient().collection("schools")
      .where("city_code", "==", params.cityCode)
      .where("is_active", "==", true)
      .where("search_keywords", "array-contains", keyword)
      .limit(Math.min(params.limit * 2, 20))
      .get();
    return snapshot.docs.map((document) => fromDocument(document.id, document.data()))
      .filter((school) => params.cityWide || school.zone_code === params.zoneCode || school.city_code === params.cityCode);
  }

  async getByIds(ids: string[]) {
    if (!ids.length) return [];
    const firestore = firestoreClient();
    const snapshots = await firestore.getAll(...ids.slice(0, 20).map((id) => firestore.collection("schools").doc(id)));
    return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => fromDocument(snapshot.id, snapshot.data()!));
  }

  async getById(id: string) {
    const snapshot = await firestoreClient().collection("schools").doc(id).get();
    return snapshot.exists ? fromDocument(snapshot.id, snapshot.data()!) : null;
  }

  async saveMany(schools: SchoolSearchResult[]) {
    if (!schools.length) return;
    const firestore = firestoreClient();
    const references = schools.map((school) => firestore.collection("schools").doc(school.id));
    const existing = await firestore.getAll(...references);
    const batch = firestore.batch();
    schools.forEach((school, index) => batch.set(references[index], {
      ...schoolData(school),
      ...(!existing[index].exists ? { created_at: FieldValue.serverTimestamp() } : {}),
    }, { merge: true }));
    await batch.commit();
  }

  async saveManual(school: SchoolSearchResult) { await this.saveMany([school]); }

  async getCached(params: SchoolSearchParams) {
    const snapshot = await firestoreClient().collection("school_search_cache").doc(cacheId(params)).get();
    if (!snapshot.exists) return null;
    const expiresAt = snapshot.get("expires_at") as Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() <= Date.now()) return null;
    const ids = Array.isArray(snapshot.get("result_ids")) ? snapshot.get("result_ids") as string[] : [];
    const schools = await this.getByIds(ids);
    return schools.length ? { schools, providerUsed: String(snapshot.get("provider_used") || "firestore") } : null;
  }

  async setCached(params: SchoolSearchParams, schools: SchoolSearchResult[], providerUsed: string) {
    await firestoreClient().collection("school_search_cache").doc(cacheId(params)).set({
      query: normalizeSchoolName(params.query),
      city_code: params.cityCode,
      zone_code: params.cityWide ? null : params.zoneCode,
      city_wide: Boolean(params.cityWide),
      result_ids: schools.slice(0, params.limit).map((school) => school.id),
      provider_used: providerUsed,
      created_at: FieldValue.serverTimestamp(),
      expires_at: Timestamp.fromMillis(Date.now() + CACHE_TTL_MS),
    });
  }
}
