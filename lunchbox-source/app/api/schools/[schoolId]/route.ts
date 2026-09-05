import { NextResponse } from "next/server";
import { schoolDirectory } from "@/lib/school-locator";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await context.params;
  if (!/^[A-Z0-9-]{8,80}$/i.test(schoolId)) return NextResponse.json({ error: "Invalid school ID." }, { status: 400 });
  const school = await schoolDirectory.getById(schoolId);
  return school ? NextResponse.json({ school }) : NextResponse.json({ error: "School not found." }, { status: 404 });
}
