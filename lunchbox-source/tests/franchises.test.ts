import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const firestoreList = vi.fn();
  const firestoreDetail = vi.fn();
  const limit = vi.fn(() => ({ get: firestoreList }));
  const where = vi.fn(() => ({ limit }));
  const doc = vi.fn(() => ({ get: firestoreDetail }));
  const collection = vi.fn(() => ({ where, doc }));
  const download = vi.fn();
  const file = vi.fn(() => ({ name: "franchises.json", download }));
  const getFiles = vi.fn();
  const bucket = vi.fn((name?: string) => {
    void name;
    return { file, getFiles };
  });
  return { firestoreList, firestoreDetail, limit, where, doc, collection, download, file, getFiles, bucket };
});

vi.mock("@/lib/firestore", () => ({
  firestoreClient: () => ({ collection: mocks.collection }),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket(name: string) { return mocks.bucket(name); }
  },
}));

import { getFranchise, getFranchises } from "@/lib/franchises";

function firestoreDocument(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("franchise directory data sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GCP_PROJECT_ID", "test-project");
    vi.stubEnv("GCS_BUCKET", "test-bucket");
    vi.stubEnv("GCS_FRANCHISES_OBJECT", "franchises.json");
    mocks.firestoreList.mockResolvedValue({ docs: [] });
    mocks.firestoreDetail.mockResolvedValue({ exists: false });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("prefers active Firestore records and allows the directory's 1,000-record limit", async () => {
    mocks.firestoreList.mockResolvedValue({
      docs: [firestoreDocument("firestore-franchise", { name: "Firestore Partner", area: "Adyar" })],
    });

    const result = await getFranchises();

    expect(result.source).toBe("firestore");
    expect(result.franchises[0]).toMatchObject({ id: "firestore-franchise", name: "Firestore Partner" });
    expect(mocks.limit).toHaveBeenCalledWith(1000);
    expect(mocks.bucket).not.toHaveBeenCalled();
  });

  it("falls back to the documented Storage object when Firestore is empty", async () => {
    mocks.download.mockResolvedValue([Buffer.from(JSON.stringify({
      franchises: [
        { id: "velachery-cafe", name: "Velachery Cafe", area: "Velachery", active: true },
        { name: "Adyar Kitchen", area: "Adyar", address: "1 School Road", active: true },
        { id: "closed", name: "Closed Partner", area: "Adyar", active: false },
      ],
    }))]);

    const result = await getFranchises({ search: "adyar" });

    expect(result.source).toBe("gcs");
    expect(result.franchises).toHaveLength(1);
    expect(result.franchises[0]).toMatchObject({ id: "adyar-kitchen-adyar-1-school-road", name: "Adyar Kitchen" });
    expect(mocks.file).toHaveBeenCalledWith("franchises.json");
  });

  it("uses the same Storage fallback for franchise detail pages", async () => {
    mocks.download.mockResolvedValue([Buffer.from(JSON.stringify([
      { id: "anna-nagar", name: "Anna Nagar Partner", city: "Chennai", active: true },
    ]))]);

    await expect(getFranchise("anna-nagar")).resolves.toMatchObject({
      id: "anna-nagar",
      name: "Anna Nagar Partner",
    });
  });
});
