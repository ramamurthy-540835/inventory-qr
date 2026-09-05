import { after, NextResponse } from "next/server";
import { entityAnalytics, entityDirectory } from "@/lib/entity-locator";
import { createManualEntity } from "@/lib/entity-locator/api";
import { enforceRateLimit, RateLimitError } from "@/lib/hardening";
import { logInfo } from "@/lib/logging";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const identity = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit("manual_office", identity, 5, 3600);
    const result = createManualEntity("office", await request.json() as Record<string, unknown>);
    if (!result.entity) return NextResponse.json({ error: result.error }, { status: 400 });
    await entityDirectory.saveMany("office", [result.entity]);
    after(async () => { await entityAnalytics.recordEntities("office", [result.entity!]).catch(() => undefined); });
    logInfo("entity_manual_created", { entity_type: "office", city: result.entity.city_code, zone: result.entity.zone_code });
    return NextResponse.json({ office: result.entity, entity: result.entity }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof RateLimitError ? error.message : "Unable to add this office manually." }, { status: error instanceof RateLimitError ? 429 : 500 }); }
}
