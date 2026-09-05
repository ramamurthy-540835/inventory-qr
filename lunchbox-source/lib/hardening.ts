import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { firestoreClient, isFirestoreConfigured } from "@/lib/firestore";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please try again shortly.");
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(scope: string, identity: string, limit: number, windowSeconds: number) {
  if (!isFirestoreConfigured()) return;
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const id = createHash("sha256").update(`${scope}:${identity}:${bucket}`).digest("hex");
  const reference = firestoreClient().collection("rate_limits").doc(id);
  await firestoreClient().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const count = snapshot.exists ? Number(snapshot.get("count")) : 0;
    if (count >= limit) throw new RateLimitError();
    transaction.set(reference, {
      scope,
      count: count + 1,
      expires_at: Timestamp.fromMillis((bucket + 2) * windowSeconds * 1000),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function writeAuditLog(actorUid: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  if (!isFirestoreConfigured()) return;
  await firestoreClient().collection("audit_logs").add({
    actor_uid: actorUid,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    created_at: FieldValue.serverTimestamp(),
  });
}
