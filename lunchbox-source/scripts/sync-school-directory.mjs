#!/usr/bin/env node

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : "";
};

const cityInput = option("city").toUpperCase();
const zoneInput = option("zone").toUpperCase();
const baseUrl = (process.env.LUNCHBOX_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const taskSecret = process.env.SCHOOL_DISCOVERY_TASK_SECRET;
const maxLocalities = Number(option("max-localities") || 0);

if (!cityInput || !taskSecret) {
  console.error("Usage: node scripts/sync-school-directory.mjs --city chennai [--zone west] [--max-localities 2]");
  console.error("LUNCHBOX_BASE_URL and SCHOOL_DISCOVERY_TASK_SECRET must be configured.");
  process.exit(1);
}

const citiesResponse = await fetch(`${baseUrl}/api/location/cities`);
if (!citiesResponse.ok) throw new Error("Unable to load configured cities.");
const { cities } = await citiesResponse.json();
const city = cities.find((item) => item.code === cityInput || item.name.toUpperCase() === cityInput);
if (!city) throw new Error("Unsupported city.");

const zonesResponse = await fetch(`${baseUrl}/api/location/zones?city=${city.code}`);
if (!zonesResponse.ok) throw new Error("Unable to load configured zones.");
const { zones } = await zonesResponse.json();
const selectedZones = zoneInput
  ? zones.filter((zone) => zone.code === zoneInput || zone.code.endsWith(`_${zoneInput}`) || zone.name.toUpperCase() === zoneInput)
  : zones;
if (!selectedZones.length) throw new Error("Unsupported zone.");

for (const zone of selectedZones) {
  const response = await fetch(`${baseUrl}/api/tasks/sync-school-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Task-Secret": taskSecret },
    body: JSON.stringify({ city: city.code, zone: zone.code, ...(maxLocalities > 0 ? { maxLocalities } : {}) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Sync failed for ${zone.code}.`);
  console.log(JSON.stringify(result));
}
