import { describe, expect, it, vi } from "vitest";
import {
  BlobStoreRelayService,
  MemoryRelayStorageClient,
} from "./blob-store-relay.js";
import { companyTransferRuns } from "@paperclipai/db";

function createMockDb() {
  const store = {
    companyTransferRuns: [] as any[],
  };

  const db: any = {
    _store: store,
    transaction: async (cb: any) => cb(db),
    execute: async () => ({ rows: [] }),
    insert: (table: any) => ({
      values: (val: any) => {
        const row = { id: `run-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), completedParts: [], ...val };
        store.companyTransferRuns.push(row);
        const promise = Promise.resolve([row]) as any;
        promise.returning = async () => [row];
        return promise;
      },
    }),
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            if (table === companyTransferRuns) return store.companyTransferRuns;
            return [];
          },
        }),
        limit: async () => {
          if (table === companyTransferRuns) return store.companyTransferRuns;
          return [];
        },
      }),
    }),
    update: () => ({
      set: (updates: any) => ({
        where: () => ({
          returning: async () => {
            if (store.companyTransferRuns.length > 0) {
              const item = { ...store.companyTransferRuns[0], ...updates };
              store.companyTransferRuns[0] = item;
              return [item];
            }
            return [updates];
          },
        }),
      }),
    }),
  };

  return db;
}

// Mock company portability service
vi.mock("./company-portability.js", () => ({
  companyPortabilityService: () => ({
    exportBundle: vi.fn().mockResolvedValue({
      manifest: {
        schemaVersion: 7,
        company: { name: "Test Corp", issuePrefix: "TC" },
        agents: [],
        projects: [],
      },
      files: {
        "agents/ceo.json": JSON.stringify({ role: "ceo" }),
      },
    }),
    importBundle: vi.fn().mockResolvedValue({
      company: { id: "company-imported-1", name: "Test Corp" },
      warnings: [],
    }),
  }),
}));

// Mock company transfer run service
vi.mock("./company-transfer-runs.js", () => ({
  companyTransferRunService: {
    resumeOrCreate: vi.fn().mockResolvedValue({
      run: { id: "run-test-1", completedParts: [] },
      isNew: true,
    }),
    start: vi.fn().mockResolvedValue({ id: "run-test-1", status: "running" }),
    completePart: vi.fn().mockResolvedValue({ id: "run-test-1" }),
    complete: vi.fn().mockResolvedValue({ id: "run-test-1", status: "completed" }),
  },
}));

describe("BlobStoreRelayService", () => {
  it("exports company snapshot directly to blob store and tracks transfer progress", async () => {
    const memoryStorage = new MemoryRelayStorageClient();
    const service = new BlobStoreRelayService(memoryStorage, "test-relay-bucket");
    const db = createMockDb();

    const result = await service.exportCompanyToRelay(db, "company-123", {
      prefix: "staging/company-123/tx-1/",
      actorKey: "user:tester",
    });

    expect(result.bucket).toBe("test-relay-bucket");
    expect(result.prefix).toBe("staging/company-123/tx-1/");
    expect(result.totalParts).toBe(2); // manifest.json + agents/ceo.json
    expect(result.manifestSha256).toBeDefined();

    // Verify written to storage
    const manifestBuf = await memoryStorage.getObject("staging/company-123/tx-1/manifest.json");
    expect(manifestBuf.length).toBeGreaterThan(0);
    const ceoBuf = await memoryStorage.getObject("staging/company-123/tx-1/agents/ceo.json");
    expect(ceoBuf.toString("utf-8")).toContain("ceo");
  });

  it("imports company snapshot directly from blob store and validates manifest", async () => {
    const memoryStorage = new MemoryRelayStorageClient();
    const service = new BlobStoreRelayService(memoryStorage, "test-relay-bucket");
    const db = createMockDb();

    // Populate storage
    const fakeManifest = {
      schemaVersion: 7,
      company: { name: "Remote Cloud Corp", issuePrefix: "RCC" },
    };
    await memoryStorage.putObject(
      "relay/rcc/t1/manifest.json",
      Buffer.from(JSON.stringify(fakeManifest)),
    );
    await memoryStorage.putObject(
      "relay/rcc/t1/skills/code.md",
      Buffer.from("# Python skill"),
    );

    const result = await service.importCompanyFromRelay(db, {
      bucket: "test-relay-bucket",
      prefix: "relay/rcc/t1",
      actorKey: "user:admin",
    });

    expect(result.status).toBe("completed");
    expect(result.companyName).toBe("Test Corp");
    expect(result.totalPartsImported).toBe(2);
  });
});
