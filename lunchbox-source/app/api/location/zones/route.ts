import { NextResponse } from "next/server";
import { CITY_BY_CODE, type CityCode } from "@/lib/school-locator/territories";

export function GET(request: Request) {
  const cityCode = new URL(request.url).searchParams.get("city")?.toUpperCase() as CityCode | undefined;
  const city = cityCode ? CITY_BY_CODE.get(cityCode) : null;
  if (!city) return NextResponse.json({ error: "Choose a supported city." }, { status: 400 });
  return NextResponse.json({ city: { code: city.code, name: city.name }, zones: city.zones.map((zone) => ({ code: zone.code, name: zone.name, localities: zone.localities })) }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
