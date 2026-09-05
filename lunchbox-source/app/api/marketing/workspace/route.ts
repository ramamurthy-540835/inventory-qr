import { createHash } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { NextResponse } from "next/server";
import { ParentAuthError, verifyMarketingAdmin } from "@/lib/firebase-admin";
import { firestoreClient } from "@/lib/firestore";
import { enforceRateLimit, RateLimitError, writeAuditLog } from "@/lib/hardening";

export const runtime = "nodejs";

const collections = {
  lead: "marketing_leads",
  event: "marketing_events",
  activity: "outreach_activities",
} as const;
type Entity = keyof typeof collections;

async function workspaceActor(request: Request) {
  if (process.env.MARKETING_OS_PUBLIC === "true") return { uid: "development-public", email: "public-development-mode" };
  return verifyMarketingAdmin(request);
}

function entity(value: unknown): Entity | null { return typeof value === "string" && value in collections ? value as Entity : null; }
function recordId(kind: Entity, record: Record<string, unknown>) { const key = kind === "lead" ? record.id : kind === "event" ? record.eventId : record.activityId; return typeof key === "string" ? key.trim() : ""; }
function documentId(value: string) { return createHash("sha256").update(value).digest("hex"); }
function validRecord(kind: Entity, record: Record<string, unknown>) {
  const id = recordId(kind, record);
  if (!id || id.length > 300 || JSON.stringify(record).length > 40_000) return false;
  if (kind === "lead") return typeof record.name === "string" && typeof record.city === "string" && typeof record.stage === "string";
  if (kind === "event") return typeof record.title === "string" && typeof record.scheduledDate === "string" && Array.isArray(record.linkedLeadIds);
  return typeof record.leadId === "string" && typeof record.activityType === "string" && typeof record.outcome === "string";
}
function fail(error: unknown) {
  const status = error instanceof RateLimitError ? 429 : error instanceof ParentAuthError ? 403 : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manage Marketing OS data." }, { status });
}

export async function GET(request: Request) {
  try {
    const admin = await workspaceActor(request); await enforceRateLimit("marketing_workspace_read", admin.uid, 120, 60);
    const firestore = firestoreClient();
    const [leads, events, activities] = await Promise.all(Object.values(collections).map((name) => firestore.collection(name).get()));
    return NextResponse.json({
      leads: leads.docs.map((doc) => doc.data().record),
      events: events.docs.map((doc) => doc.data().record),
      activities: activities.docs.map((doc) => doc.data().record),
    });
  } catch (error) { return fail(error); }
}

export async function PUT(request: Request) {
  try {
    const admin = await workspaceActor(request); await enforceRateLimit("marketing_workspace_write", admin.uid, 300, 60);
    const body = await request.json() as { entity?: unknown; record?: unknown };
    const kind = entity(body.entity); const record = body.record && typeof body.record === "object" && !Array.isArray(body.record) ? body.record as Record<string, unknown> : null;
    if (!kind || !record || !validRecord(kind, record)) return NextResponse.json({ error: "Enter a valid marketing record." }, { status: 400 });
    const id = recordId(kind, record);
    await firestoreClient().collection(collections[kind]).doc(documentId(id)).set({ record, source_id: id, updated_at: FieldValue.serverTimestamp(), updated_by: admin.uid }, { merge: true });
    await writeAuditLog(admin.uid, `marketing.${kind}.upsert`, kind, id);
    return NextResponse.json({ id, saved: true });
  } catch (error) { return fail(error); }
}

export async function DELETE(request: Request) {
  try {
    const admin = await workspaceActor(request); await enforceRateLimit("marketing_workspace_write", admin.uid, 300, 60);
    const url = new URL(request.url); const kind = entity(url.searchParams.get("entity")); const id = url.searchParams.get("id")?.trim() || "";
    if (!kind || !id || id.length > 300) return NextResponse.json({ error: "Choose a valid marketing record." }, { status: 400 });
    await firestoreClient().collection(collections[kind]).doc(documentId(id)).delete();
    await writeAuditLog(admin.uid, `marketing.${kind}.delete`, kind, id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) { return fail(error); }
}
