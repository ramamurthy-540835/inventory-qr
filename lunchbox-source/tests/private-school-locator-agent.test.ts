import { describe, expect, it } from "vitest";
import { PrivateSchoolLocatorAgent } from "@/lib/school-locator/private-school-locator-agent";
import type {
  SchoolAnalytics, SchoolDirectoryRepository, SchoolSearchProvider, SchoolSearchResult,
} from "@/lib/school-locator/types";

const params = { cityCode: "CHENNAI" as const, zoneCode: "CHENNAI_WEST" as const, query: "mah", limit: 10 };

function school(id: string, overrides: Partial<SchoolSearchResult> = {}): SchoolSearchResult {
  return {
    id, school_name: "Maharishi Vidya Mandir", normalized_name: "maharishi vidya mandir",
    formatted_address: "Gerugambakkam, Chennai, Tamil Nadu 600122", locality: "Gerugambakkam", sub_locality: null,
    zone_code: "CHENNAI_WEST", zone_name: "West Chennai", city_code: "CHENNAI", city_name: "Chennai",
    state: "Tamil Nadu", postal_code: "600122", latitude: 13.01, longitude: 80.13,
    provider: "google", provider_place_id: id, school_type: "school", school_board: null,
    private_status: "unverified", confidence: 0.95, is_active: true, search_keywords: ["mah"],
    ...overrides,
  };
}

function setup(options: {
  local?: SchoolSearchResult[];
  cached?: SchoolSearchResult[];
  google?: SchoolSearchResult[] | Error;
  serpapi?: SchoolSearchResult[] | Error;
  analyticsFailure?: boolean;
} = {}) {
  let googleCalls = 0;
  let serpCalls = 0;
  const repository: SchoolDirectoryRepository = {
    search: async () => options.local || [],
    getByIds: async () => [],
    getById: async () => null,
    saveMany: async () => undefined,
    saveManual: async () => undefined,
    getCached: async () => options.cached ? { schools: options.cached, providerUsed: "google" } : null,
    setCached: async () => undefined,
  };
  const provider = (name: "google" | "serpapi", result: SchoolSearchResult[] | Error | undefined): SchoolSearchProvider => ({
    name,
    searchSchools: async () => {
      if (name === "google") googleCalls += 1; else serpCalls += 1;
      if (result instanceof Error) throw result;
      return result || [];
    },
    getSchoolDetails: async () => null,
  });
  const analyticsMethod = async () => {
    if (options.analyticsFailure) throw new Error("BigQuery unavailable");
  };
  const analytics: SchoolAnalytics = {
    recordSearch: analyticsMethod, recordSchools: analyticsMethod,
    recordRegistration: analyticsMethod, recordProviderUsage: analyticsMethod,
  };
  const agent = new PrivateSchoolLocatorAgent({
    repository,
    google: provider("google", options.google),
    serpapi: provider("serpapi", options.serpapi),
    analytics,
    defer: (task) => { void task(); },
  });
  return { agent, calls: () => ({ google: googleCalls, serpapi: serpCalls }) };
}

describe("PrivateSchoolLocatorAgent", () => {
  it("does not call an external provider for a two-character query", () => {
    const { agent, calls } = setup();
    expect(() => agent.search({ ...params, query: "ma" })).toThrow(/three characters/i);
    expect(calls()).toEqual({ google: 0, serpapi: 0 });
  });

  it("allows provider calls at three characters", async () => {
    const { agent, calls } = setup({ google: [school("google-1")] });
    await agent.search(params);
    expect(calls().google).toBe(1);
  });

  it("returns Chennai West school matches", async () => {
    const { agent } = setup({ google: [school("google-1")] });
    const response = await agent.search(params);
    expect(response.results[0]).toMatchObject({ school_name: "Maharishi Vidya Mandir", zone_code: "CHENNAI_WEST" });
  });

  it("filters a school assigned to the wrong city", async () => {
    const wrongCity = school("madurai-1", { city_code: "MADURAI", city_name: "Madurai", zone_code: "MADURAI_CENTRAL", zone_name: "Central Madurai" });
    const { agent } = setup({ google: [wrongCity], serpapi: [] });
    expect((await agent.search(params)).results).toHaveLength(0);
  });

  it("uses SerpAPI when Google is unavailable", async () => {
    const { agent } = setup({ google: new Error("offline"), serpapi: [school("serp-1", { provider: "serpapi" })] });
    expect((await agent.search(params)).results[0].provider).toBe("serpapi");
  });

  it("keeps Google results when SerpAPI is unavailable", async () => {
    const google = school("google-1", { school_name: "Sri Maharishi School", normalized_name: "sri maharishi school" });
    const { agent } = setup({ google: [google], serpapi: new Error("offline") });
    expect((await agent.search(params)).results[0].provider).toBe("google");
  });

  it("enables manual fallback when both providers are unavailable", async () => {
    const { agent } = setup({ google: new Error("offline"), serpapi: new Error("offline") });
    const response = await agent.search(params);
    expect(response.results).toHaveLength(0);
    expect(response.meta.manual_available).toBe(true);
  });

  it("returns one result for a duplicate Google and SerpAPI school", async () => {
    const duplicate = school("same-place", { school_name: "Sri Maharishi School", normalized_name: "sri maharishi school" });
    const { agent } = setup({ google: [duplicate], serpapi: [{ ...duplicate, id: "serp-copy", provider: "serpapi" }] });
    expect((await agent.search(params)).results).toHaveLength(1);
  });

  it("returns an exact Firestore prefix match without external calls", async () => {
    const local = [school("local-1")];
    const { agent, calls } = setup({ local });
    expect((await agent.search(params)).results).toHaveLength(1);
    expect(calls()).toEqual({ google: 0, serpapi: 0 });
  });

  it("returns a cached query without external provider calls", async () => {
    const { agent, calls } = setup({ cached: [school("cached-1")] });
    const response = await agent.search(params);
    expect(response.meta.cache_hit).toBe(true);
    expect(response.results).toHaveLength(1);
    expect(calls()).toEqual({ google: 0, serpapi: 0 });
  });

  it("does not break search when analytics fails", async () => {
    const { agent } = setup({ google: [school("google-1")], analyticsFailure: true });
    await expect(agent.search(params)).resolves.toMatchObject({ meta: { count: 1 } });
  });
});
