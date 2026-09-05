import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { ENTITY_PROFILES } from "@/lib/entity-locator/profiles";
import { normalizeEntityName } from "@/lib/entity-locator/normalization";
import type { EntityDirectoryRepository, EntitySearchParams, EntityType, LocationEntityResult } from "@/lib/entity-locator/types";
import { firestoreClient } from "@/lib/firestore";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
function cacheId(params: EntitySearchParams) {
  return createHash("sha256").update(`${params.entityType}:${params.cityCode}:${params.cityWide ? "ALL" : params.zoneCode}:${normalizeEntityName(params.query)}`).digest("hex");
}
function fromDocument(id: string, data: Record<string, unknown>): LocationEntityResult {
  const clean = { ...data }; delete clean.created_at; delete clean.updated_at; delete clean.last_verified_at;
  return { ...(clean as Omit<LocationEntityResult, "id">), id, outside_selected_zone: Boolean(clean.outside_selected_zone) };
}

export class FirestoreEntityDirectory implements EntityDirectoryRepository {
  private collection(entityType: EntityType) { return firestoreClient().collection(ENTITY_PROFILES[entityType].collection); }

  async search(params: EntitySearchParams) {
    const keyword = normalizeEntityName(params.query);
    if (keyword.length < 3) return [];
    const snapshot = await this.collection(params.entityType).where("city_code", "==", params.cityCode).where("is_active", "==", true)
      .where("search_keywords", "array-contains", keyword).limit(Math.min(params.limit * 2, 20)).get();
    return snapshot.docs.map((document) => fromDocument(document.id, document.data()))
      .filter((entity) => params.cityWide || entity.zone_code === params.zoneCode || entity.city_code === params.cityCode);
  }

  async getByIds(entityType: EntityType, ids: string[]) {
    if (!ids.length) return [];
    const references = ids.slice(0, 20).map((id) => this.collection(entityType).doc(id));
    const snapshots = await firestoreClient().getAll(...references);
    return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => fromDocument(snapshot.id, snapshot.data()!));
  }

  async getById(entityType: EntityType, id: string) {
    const snapshot = await this.collection(entityType).doc(id).get();
    return snapshot.exists ? fromDocument(snapshot.id, snapshot.data()!) : null;
  }

  async saveMany(entityType: EntityType, entities: LocationEntityResult[]) {
    if (!entities.length) return;
    const references = entities.map((entity) => this.collection(entityType).doc(entity.id));
    const existing = await firestoreClient().getAll(...references);
    const batch = firestoreClient().batch();
    entities.forEach((entity, index) => batch.set(references[index], {
      ...entity, outside_selected_zone: FieldValue.delete(), updated_at: FieldValue.serverTimestamp(),
      last_verified_at: FieldValue.serverTimestamp(), ...(!existing[index].exists ? { created_at: FieldValue.serverTimestamp() } : {}),
    }, { merge: true }));
    await batch.commit();
  }

  async getCached(params: EntitySearchParams) {
    const snapshot = await firestoreClient().collection("entity_search_cache").doc(cacheId(params)).get();
    if (!snapshot.exists) return null;
    const expiresAt = snapshot.get("expires_at") as Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() <= Date.now()) return null;
    const ids = Array.isArray(snapshot.get("result_ids")) ? snapshot.get("result_ids") as string[] : [];
    const entities = await this.getByIds(params.entityType, ids);
    return entities.length ? { entities, providerUsed: String(snapshot.get("provider_used") || "firestore") } : null;
  }

  async setCached(params: EntitySearchParams, entities: LocationEntityResult[], providerUsed: string) {
    await firestoreClient().collection("entity_search_cache").doc(cacheId(params)).set({
      entity_type: params.entityType, query: normalizeEntityName(params.query), city_code: params.cityCode,
      zone_code: params.cityWide ? null : params.zoneCode, city_wide: Boolean(params.cityWide),
      result_ids: entities.slice(0, params.limit).map((entity) => entity.id), provider_used: providerUsed,
      created_at: FieldValue.serverTimestamp(), expires_at: Timestamp.fromMillis(Date.now() + CACHE_TTL_MS),
    });
  }
}
