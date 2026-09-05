/*
 * Collects up to 1,000 unique, publicly listed Chennai franchise locations
 * from Google Maps via SerpAPI. Each query requests six Maps result pages.
 * Usage: node scripts/collect-chennai-franchises.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function keyFromEnvFile(file) {
  try {
    const contents = await readFile(resolve(file), "utf8");
    const match = contents.match(/^\s*(?:SERPAPI_KEY|SERP_API_KEY)\s*=\s*["']?([^\r\n"']+)["']?\s*$/m);
    return match?.[1]?.trim();
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

const key = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || await keyFromEnvFile(".env.local") || await keyFromEnvFile(".env");
if (!key) throw new Error("SERPAPI_KEY is required. Add it to .env.local or your environment, then run this script again.");

const areas = [
  "Adyar", "Alwarpet", "Ambattur", "Anna Nagar", "Chromepet", "Egmore", "Guindy", "Kilpauk",
  "Medavakkam", "Nungambakkam", "OMR", "Porur", "Purasaiwakkam", "Tambaram", "T Nagar", "Thiruvanmiyur", "Velachery",
];
const categories = [
  "restaurant franchise", "fast food franchise", "cafe franchise", "tea shop franchise", "bakery franchise",
  "ice cream franchise", "food delivery franchise", "fitness franchise", "salon franchise", "education franchise",
  "preschool franchise", "retail franchise", "supermarket franchise", "healthcare franchise", "car service franchise",
];
const starts = [0, 20, 40, 60, 80, 100];
const queries = categories.flatMap((category) => areas.map((area) => `${category} in ${area}, Chennai`));
const outputPath = resolve("data/chennai-franchises.json");
const directoryLimit = 1000;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function idFor(...parts) { return parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function categoryFor(result, query) {
  const type = Array.isArray(result.type) ? result.type[0] : result.type;
  return text(type) || query.replace(/ in .+$/, "").replace(/ franchise$/i, "");
}
function areaFor(address, query) {
  const match = areas.find((area) => new RegExp(`\\b${area.replace(/ /g, "\\s+")}\\b`, "i").test(address));
  return match || (query.match(/in (.+), Chennai$/i)?.[1] ?? "Chennai");
}
function recordKey(result, name, address) {
  const placeId = text(result.place_id);
  const dataId = text(result.data_id);
  // Maps identifiers are stable across overlapping category/area searches.
  if (placeId) return `place:${placeId}`;
  if (dataId) return `data:${dataId}`;
  // A small fallback keeps publicly returned rows without identifiers from
  // creating obvious duplicates while preserving the identifier-first rule.
  return `fallback:${idFor(name, address)}`;
}
function mergeRecord(existing, candidate) {
  return { ...existing, ...Object.fromEntries(Object.entries(candidate).filter(([, value]) => value !== "" && value !== null)) };
}

const records = new Map();
let fetchedPages = 0;
let failedPages = 0;
console.log(`Searching ${queries.length} Chennai area/category combinations across ${starts.length} Google Maps pages each (up to ${directoryLimit} unique listings).`);

for (const query of queries) {
  for (const start of starts) {
    if (records.size >= directoryLimit) break;
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({ engine: "google_maps", q: query, type: "search", start: String(start), api_key: key }).toString();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      fetchedPages += 1;
      for (const result of payload.local_results || []) {
        if (records.size >= directoryLimit) break;
        const name = text(result.title);
        const address = text(result.address);
        if (!name || !address || !/chennai|tamil nadu/i.test(address)) continue;
        const key = recordKey(result, name, address);
        const candidate = {
          id: idFor(key),
          placeId: text(result.place_id),
          dataId: text(result.data_id),
          name,
          category: categoryFor(result, query),
          companyName: text(result.company_name),
          address,
          area: areaFor(address, query),
          city: "Chennai",
          phone: text(result.phone),
          website: text(result.website),
          email: "",
          description: text(result.description),
          rating: typeof result.rating === "number" ? result.rating : null,
          reviews: typeof result.reviews === "number" ? result.reviews : null,
          mapsUrl: text(result.link),
          sourceUrl: text(result.website) || text(result.link),
          lastVerifiedAt: new Date().toISOString(),
        };
        const existing = records.get(key);
        records.set(key, existing ? mergeRecord(existing, candidate) : candidate);
      }
    } catch (error) {
      failedPages += 1;
      console.warn(`Skipping ${query} (start=${start}): ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  if (records.size >= directoryLimit) break;
}

const franchises = [...records.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, directoryLimit);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: "SerpAPI Google Maps", franchises }, null, 2) + "\n");
console.log(`Saved ${franchises.length} unique verified Chennai franchise records to ${outputPath} (${fetchedPages} pages fetched, ${failedPages} pages skipped).`);
