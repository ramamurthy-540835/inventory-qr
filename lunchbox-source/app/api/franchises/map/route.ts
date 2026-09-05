import { NextResponse } from "next/server";
import { getFranchises } from "@/lib/franchises";
export const runtime = "nodejs";
export async function GET(request: Request) { const url = new URL(request.url); const { franchises } = await getFranchises({ area: url.searchParams.get("area") || undefined, category: url.searchParams.get("category") || undefined, search: url.searchParams.get("search") || undefined, limit: 250 }); return NextResponse.json({ franchises: franchises.map((item) => ({ id: item.id, name: item.name, category: item.category, area: item.area, driverCount: item.studentCount, activeDriverCount: 0, serviceArea: null })) }); }
