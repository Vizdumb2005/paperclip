import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { companyTransferRuns } from "@paperclipai/db";
import { companyPortabilityService } from "./company-portability.js";
import { companyTransferRunService } from "./company-transfer-runs.js";
import type {
  CompanyPortabilityFileEntry,
  CompanyPortabilityManifest,
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityImportTarget,
} from "@paperclipai/shared";
import { eq } from "drizzle-orm";

export interface RelayStorageClient {
  putObject(key: string, body: Buffer, contentType?: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  headObject(key: string): Promise<{ size: number; etag?: string } | null>;
  listObjects(prefix: string): Promise<string[]>;
}

/**
 * In-memory / mockable or S3-backed Relay Storage Driver.
 */
export class MemoryRelayStorageClient implements RelayStorageClient {
  private store = new Map<string, { body: Buffer; contentType?: string }>();

  async putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
    this.store.set(key, { body, contentType });
  }

  async getObject(key: string): Promise<Buffer> {
    const item = this.store.get(key);
    if (!item) throw new Error(`Blob not found in relay: ${key}`);
    return item.body;
  }

  async headObject(key: string): Promise<{ size: number } | null> {
    const item = this.store.get(key);
    if (!item) return null;
    return { size: item.body.length };
  }

  async listObjects(prefix: string): Promise<string[]> {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }
}

export interface RelayExportOptions {
  bucket?: string;
  prefix?: string;
  includeArtifacts?: boolean;
  actorKey?: string;
}

export interface RelayExportResult {
  transferId: string;
  bucket: string;
  prefix: string;
  manifestSha256: string;
  totalParts: number;
  totalBytes: number;
  companyId: string;
  completedAt: string;
}

export interface RelayImportInput {
  transferId?: string;
  bucket: string;
  prefix: string;
  manifestSha256?: string;
  targetCompanyId?: string;
  collisionStrategy?: CompanyPortabilityCollisionStrategy;
  actorKey?: string;
}

export interface RelayImportResult {
  transferId: string;
  companyId: string;
  companyName: string;
  status: "completed";
  totalPartsImported: number;
  warnings?: string[];
}

export class BlobStoreRelayService {
  private storage: RelayStorageClient;
  private defaultBucket: string;

  constructor(storage?: RelayStorageClient, defaultBucket = "paperclip-relay") {
    this.storage = storage ?? new MemoryRelayStorageClient();
    this.defaultBucket = defaultBucket;
  }

  setStorageClient(client: RelayStorageClient) {
    this.storage = client;
  }

  /**
   * Export company snapshot directly into cloud blob storage.
   */
  async exportCompanyToRelay(
    db: Db,
    companyId: string,
    options: RelayExportOptions = {},
  ): Promise<RelayExportResult> {
    const portability = companyPortabilityService(db);
    const bucket = options.bucket ?? this.defaultBucket;
    const transferId = randomUUID();
    const prefix = options.prefix ?? `relay/${companyId}/${transferId}/`;
    const actorKey = options.actorKey ?? `user:system`;

    // Generate bundle in-memory
    const bundle = await portability.exportBundle(companyId, {
      include: {
        company: true,
        agents: true,
        projects: true,
        issues: true,
        skills: true,
      },
    });

    const manifestBuf = Buffer.from(JSON.stringify(bundle.manifest, null, 2), "utf-8");
    const manifestSha256 = createHash("sha256").update(manifestBuf).digest("hex");

    // Record transfer run
    const { run } = await companyTransferRunService.resumeOrCreate(db, {
      direction: "export",
      actorKey,
      idempotencyKey: manifestSha256,
      containerRef: { kind: "relay", bucket, prefix },
      companyId,
    });

    await companyTransferRunService.start(db, run.id);

    // Stream manifest to blob store
    await this.storage.putObject(`${prefix}manifest.json`, manifestBuf, "application/json");

    let totalBytes = manifestBuf.length;
    let totalParts = 1;

    // Stream files to blob store
    for (const [filePath, entry] of Object.entries(bundle.files)) {
      const fileBuf = typeof entry === "string"
        ? Buffer.from(entry, "utf-8")
        : Buffer.from(entry.data, "base64");

      await this.storage.putObject(`${prefix}${filePath}`, fileBuf, "application/octet-stream");
      await companyTransferRunService.completePart(db, run.id, filePath);

      totalBytes += fileBuf.length;
      totalParts++;
    }

    await companyTransferRunService.complete(db, run.id);

    return {
      transferId: run.id,
      bucket,
      prefix,
      manifestSha256,
      totalParts,
      totalBytes,
      companyId,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Import company snapshot directly from cloud blob storage.
   */
  async importCompanyFromRelay(
    db: Db,
    input: RelayImportInput,
  ): Promise<RelayImportResult> {
    const portability = companyPortabilityService(db);
    const actorKey = input.actorKey ?? "user:system";
    const prefix = input.prefix.endsWith("/") ? input.prefix : `${input.prefix}/`;

    // Fetch manifest from blob store
    const manifestBuf = await this.storage.getObject(`${prefix}manifest.json`);
    const manifestSha256 = createHash("sha256").update(manifestBuf).digest("hex");

    if (input.manifestSha256 && input.manifestSha256 !== manifestSha256) {
      throw new Error(`Relay manifest SHA256 mismatch. Expected: ${input.manifestSha256}, Actual: ${manifestSha256}`);
    }

    const manifest = JSON.parse(manifestBuf.toString("utf-8")) as CompanyPortabilityManifest;

    // Track transfer run in DB
    const { run } = await companyTransferRunService.resumeOrCreate(db, {
      direction: "import",
      actorKey,
      idempotencyKey: manifestSha256,
      containerRef: { kind: "relay", bucket: input.bucket, prefix: input.prefix },
    });

    await companyTransferRunService.start(db, run.id);

    // List and fetch all files under prefix
    const allObjectKeys = await this.storage.listObjects(prefix);
    const files: Record<string, CompanyPortabilityFileEntry> = {};

    for (const key of allObjectKeys) {
      const relativePath = key.slice(prefix.length);
      if (relativePath === "manifest.json" || !relativePath) continue;

      const fileData = await this.storage.getObject(key);
      const isText = relativePath.endsWith(".json") || relativePath.endsWith(".md") || relativePath.endsWith(".txt") || relativePath.endsWith(".yaml");

      if (isText) {
        files[relativePath] = fileData.toString("utf-8");
      } else {
        files[relativePath] = {
          encoding: "base64",
          data: fileData.toString("base64"),
        };
      }

      await companyTransferRunService.completePart(db, run.id, relativePath);
    }

    // Ensure manifest is in files
    files["manifest.json"] = manifestBuf.toString("utf-8");

    const actorUserId = input.actorKey?.startsWith("user:") ? input.actorKey.slice(5) : null;
    const target: CompanyPortabilityImportTarget = input.targetCompanyId
      ? { mode: "existing_company", companyId: input.targetCompanyId }
      : { mode: "new_company", newCompanyName: manifest.company?.name };

    // Apply import through core portability service
    const importResult = await portability.importBundle(
      {
        source: {
          type: "inline",
          files,
        },
        target,
        collisionStrategy: input.collisionStrategy ?? "rename",
      },
      actorUserId,
    );

    await companyTransferRunService.complete(db, run.id);

    return {
      transferId: run.id,
      companyId: importResult.company.id,
      companyName: importResult.company.name,
      status: "completed",
      totalPartsImported: Object.keys(files).length,
      warnings: importResult.warnings,
    };
  }

  /**
   * Get transfer status by ID.
   */
  async getTransferStatus(db: Db, transferId: string) {
    const [row] = await db
      .select()
      .from(companyTransferRuns)
      .where(eq(companyTransferRuns.id, transferId))
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      companyId: row.companyId,
      direction: row.direction,
      status: row.status,
      completedParts: row.completedParts,
      totalParts: (row.chunkCount ?? 0) + (row.blobCount ?? 0),
      error: row.error,
      updatedAt: row.updatedAt,
    };
  }
}

export const defaultBlobStoreRelayService = new BlobStoreRelayService();
