import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyMemoryProviders, memoryRecords } from "@paperclipai/db";
import type {
  CompanyMemoryProvider,
  HybridSearchQuery,
  HybridSearchResult,
  MemoryRecord,
  MemorySourceType,
  MemoryTier,
} from "@paperclipai/shared";
import {
  chunkSections,
  parseMarkdownLayout,
  reciprocalRankFusion,
  scoreBm25,
} from "./stratum-engine.js";

export function companyMemoryService(db: Db) {
  return {
    async listProviders(companyId: string): Promise<CompanyMemoryProvider[]> {
      const rows = await db
        .select()
        .from(companyMemoryProviders)
        .where(eq(companyMemoryProviders.companyId, companyId))
        .orderBy(desc(companyMemoryProviders.updatedAt));
      return rows as CompanyMemoryProvider[];
    },

    async getProvider(companyId: string, providerKey: string): Promise<CompanyMemoryProvider | null> {
      const [row] = await db
        .select()
        .from(companyMemoryProviders)
        .where(
          and(
            eq(companyMemoryProviders.companyId, companyId),
            eq(companyMemoryProviders.providerKey, providerKey),
          ),
        )
        .limit(1);
      return (row as CompanyMemoryProvider) ?? null;
    },

    async upsertProvider(
      companyId: string,
      input: {
        providerKey: string;
        name: string;
        config?: Record<string, unknown>;
        isDefault?: boolean;
      },
    ): Promise<CompanyMemoryProvider> {
      if (input.isDefault) {
        // Clear other defaults
        await db
          .update(companyMemoryProviders)
          .set({ isDefault: false })
          .where(eq(companyMemoryProviders.companyId, companyId));
      }

      const [existing] = await db
        .select()
        .from(companyMemoryProviders)
        .where(
          and(
            eq(companyMemoryProviders.companyId, companyId),
            eq(companyMemoryProviders.providerKey, input.providerKey),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(companyMemoryProviders)
          .set({
            name: input.name,
            config: input.config ?? existing.config,
            isDefault: input.isDefault ?? existing.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(companyMemoryProviders.id, existing.id))
          .returning();
        return updated as CompanyMemoryProvider;
      }

      const [created] = await db
        .insert(companyMemoryProviders)
        .values({
          companyId,
          providerKey: input.providerKey,
          name: input.name,
          config: input.config ?? {},
          isDefault: input.isDefault ?? false,
        })
        .returning();
      return created as CompanyMemoryProvider;
    },

    async ingestDocument(
      companyId: string,
      input: {
        sourceType: MemorySourceType;
        sourceId: string;
        title: string;
        content: string;
        agentId?: string | null;
        runId?: string | null;
        issueId?: string | null;
        tier?: MemoryTier;
      },
    ): Promise<MemoryRecord[]> {
      const sections = parseMarkdownLayout(input.content);
      const chunks = chunkSections(sections);

      // Clean existing chunks for this specific source
      await db
        .delete(memoryRecords)
        .where(
          and(
            eq(memoryRecords.companyId, companyId),
            eq(memoryRecords.sourceType, input.sourceType),
            eq(memoryRecords.sourceId, input.sourceId),
          ),
        );

      const recordsToInsert = chunks.map((chunk) => {
        const breadcrumbs = [input.title, ...chunk.breadcrumbs].filter(Boolean).join(" > ");
        return {
          companyId,
          agentId: input.agentId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          runId: input.runId ?? null,
          issueId: input.issueId ?? null,
          tier: input.tier ?? "consolidated",
          breadcrumbs,
          content: chunk.content,
          metadata: {
            isTable: chunk.isTable,
            tokenCount: chunk.tokenCount,
            chunkId: chunk.chunkId,
          },
        };
      });

      if (recordsToInsert.length === 0) {
        return [];
      }

      const inserted = await db
        .insert(memoryRecords)
        .values(recordsToInsert)
        .returning();

      return inserted as MemoryRecord[];
    },

    async search(
      companyId: string,
      query: HybridSearchQuery,
    ): Promise<HybridSearchResult[]> {
      const limit = query.limit ?? 5;
      const rrfK = query.rrfK ?? 60;

      // Fetch candidates from DB
      const conditions = [eq(memoryRecords.companyId, companyId)];
      if (query.tier) {
        conditions.push(eq(memoryRecords.tier, query.tier));
      }

      const candidates = await db
        .select()
        .from(memoryRecords)
        .where(and(...conditions))
        .limit(200);

      if (candidates.length === 0) {
        return [];
      }

      // Sparse ranking via BM25
      const sparseRanked = candidates
        .map((record) => {
          const text = `${record.breadcrumbs ?? ""} ${record.content ?? ""}`;
          const bm25Score = scoreBm25(query.query, text);
          return { record: record as MemoryRecord, score: bm25Score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((c) => c.record);

      // Semantic / title exact overlap ranking
      const semanticRanked = candidates
        .map((record) => {
          const lowerQ = query.query.toLowerCase();
          const lowerBread = (record.breadcrumbs ?? "").toLowerCase();
          const lowerContent = (record.content ?? "").toLowerCase();

          let score = 0;
          if (lowerBread.includes(lowerQ)) score += 3.0;
          if (lowerContent.includes(lowerQ)) score += 1.0;

          // Quality score bonus
          score *= record.qualityScore ?? 1.0;
          return { record: record as MemoryRecord, score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((c) => c.record);

      // Fuse with Stratum exact RRF
      const fused = reciprocalRankFusion(
        [
          { model: "bm25", rankedItems: sparseRanked },
          { model: "semantic", rankedItems: semanticRanked },
        ],
        rrfK,
      );

      const topResults = fused.slice(0, limit).map((f) => ({
        record: f.item,
        score: f.rrfScore,
        denseRank: f.ranks["semantic"],
        sparseRank: f.ranks["bm25"],
        rrfScore: f.rrfScore,
      }));

      return topResults;
    },

    async hydrateAgentContext(
      companyId: string,
      issue: { id: string; title: string; description?: string | null },
    ): Promise<string> {
      const q = `${issue.title} ${issue.description ?? ""}`.trim();
      const results = await this.search(companyId, { query: q, limit: 3 });

      if (results.length === 0) {
        return "";
      }

      const lines = [
        "### Company Memory & Prior Knowledge (Stratum RAG)",
        "The following context was retrieved from institutional memory for this task:",
        "",
      ];

      for (const res of results) {
        lines.push(`> **${res.record.breadcrumbs ?? "Reference"}** (Tier: ${res.record.tier})`);
        lines.push(`> ${res.record.content.replace(/\n/g, "\n> ")}`);
        lines.push("");
      }

      return lines.join("\n");
    },

    async recordRunEpisodicMemory(
      companyId: string,
      runId: string,
      issueId: string,
      agentId: string,
      summary: string,
    ): Promise<MemoryRecord | null> {
      if (!summary.trim()) return null;

      const [record] = await db
        .insert(memoryRecords)
        .values({
          companyId,
          agentId,
          sourceType: "issue_run",
          sourceId: runId,
          runId,
          issueId,
          tier: "episodic",
          breadcrumbs: `Run Trace > Issue ${issueId}`,
          content: summary,
          metadata: { recordedAt: new Date().toISOString() },
        })
        .returning();

      return record as MemoryRecord;
    },

    async listPlaybooks(companyId: string): Promise<MemoryRecord[]> {
      const rows = await db
        .select()
        .from(memoryRecords)
        .where(
          and(
            eq(memoryRecords.companyId, companyId),
            or(
              eq(memoryRecords.sourceType, "playbook"),
              eq(memoryRecords.tier, "consolidated"),
            ),
          ),
        )
        .orderBy(desc(memoryRecords.updatedAt))
        .limit(50);
      return rows as MemoryRecord[];
    },
  };
}
