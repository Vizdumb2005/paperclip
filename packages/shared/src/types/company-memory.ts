export type MemoryTier = "episodic" | "consolidated" | "promoted";

export type MemorySourceType =
  | "issue_run"
  | "document"
  | "decision"
  | "playbook"
  | "routine"
  | "external";

export interface CompanyMemoryProvider {
  id: string;
  companyId: string;
  providerKey: string;
  name: string;
  config: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MemoryRecord {
  id: string;
  companyId: string;
  agentId?: string | null;
  sourceType: MemorySourceType;
  sourceId: string;
  runId?: string | null;
  issueId?: string | null;
  tier: MemoryTier;
  breadcrumbs?: string | null;
  content: string;
  metadata: Record<string, unknown>;
  embeddingVector?: string | null;
  qualityScore?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StratumChunk {
  chunkId: string;
  breadcrumbs: string[];
  content: string;
  isTable: boolean;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface HybridSearchQuery {
  query: string;
  limit?: number;
  agentId?: string;
  tier?: MemoryTier;
  rrfK?: number;
  minScore?: number;
}

export interface HybridSearchResult {
  record: MemoryRecord;
  score: number;
  denseRank?: number;
  sparseRank?: number;
  rrfScore: number;
}

export interface IngestDocumentInput {
  documentName: string;
  category?: string;
  content: string;
  tier?: MemoryTier;
  metadata?: Record<string, unknown>;
}

export interface StratumSearchResult {
  chunkId: string;
  breadcrumbs: string[];
  content: string;
  score: number;
  tier?: string;
  title?: string;
  category?: string;
  updatedAt?: Date | string;
}

