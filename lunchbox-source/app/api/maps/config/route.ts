import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() { const key = process.env.GOOGLE_MAPS_BROWSER_API_KEY; return NextResponse.json({ key: key || "" }, { headers: { "Cache-Control": "private, max-age=300" } }); }
