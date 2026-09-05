import { NextResponse } from "next/server";
import { entityDirectory } from "@/lib/entity-locator";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Z0-9-]{8,100}$/i.test(id)) return NextResponse.json({ error: "Invalid college ID." }, { status: 400 });
  const college = await entityDirectory.getById("college", id);
  return college ? NextResponse.json({ college }) : NextResponse.json({ error: "College not found." }, { status: 404 });
}
