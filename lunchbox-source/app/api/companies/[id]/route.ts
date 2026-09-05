import { NextResponse } from "next/server";
import { entityDirectory } from "@/lib/entity-locator";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Z0-9-]{8,100}$/i.test(id)) return NextResponse.json({ error: "Invalid company ID." }, { status: 400 });
  const company = await entityDirectory.getById("company", id);
  return company ? NextResponse.json({ company }) : NextResponse.json({ error: "Company not found." }, { status: 404 });
}
