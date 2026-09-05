import { NextResponse } from "next/server";
import { SCHOOL_CITIES } from "@/lib/school-locator/territories";

export function GET() {
  return NextResponse.json({ cities: SCHOOL_CITIES.map((city) => ({ code: city.code, name: city.name })) }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
