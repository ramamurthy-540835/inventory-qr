import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Browser Maps key is not configured." }, { status: 503 });
  return NextResponse.json({ apiKey }, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
