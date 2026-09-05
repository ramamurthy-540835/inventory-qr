import { NextResponse } from "next/server";
import { ParentAuthError, verifyFranchiseAccess } from "@/lib/firebase-admin";
import { getStudentsByFranchise } from "@/lib/students";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await verifyFranchiseAccess(request, id);
    return NextResponse.json({ students: await getStudentsByFranchise(id) });
  } catch (error) {
    const status = error instanceof ParentAuthError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load students." }, { status });
  }
}
