import { NextResponse } from "next/server";
import { entityDirectory } from "@/lib/entity-locator";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Z0-9-]{8,100}$/i.test(id)) return NextResponse.json({ error: "Invalid office ID." }, { status: 400 });
  const office = await entityDirectory.getById("office", id);
  return office ? NextResponse.json({ office }) : NextResponse.json({ error: "Office not found." }, { status: 404 });
}
