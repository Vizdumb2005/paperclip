import type { IngestDocumentInput, MemoryRecord, StratumSearchResult } from "@paperclipai/shared";
import { api } from "./client";

export type MemorySearchResult = StratumSearchResult;

export interface CompanyPlaybook {
  id: string;
  title: string;
  category: string;
  content: string;
  version?: number;
  updatedAt?: string | Date;
}

export const companyMemoryApi = {
  search: async (
    companyId: string,
    query: string,
    options?: { limit?: number; tier?: string },
  ): Promise<MemorySearchResult[]> => {
    const res = await api.post<{ results: StratumSearchResult[] }>(
      `/companies/${companyId}/memory/search`,
      { query, ...options },
    );
    return res.results ?? [];
  },
  getPlaybooks: async (companyId: string): Promise<CompanyPlaybook[]> => {
    const res = await api.get<{ playbooks: MemoryRecord[] }>(
      `/companies/${companyId}/memory/playbooks`,
    );
    return (res.playbooks ?? []).map((pb) => ({
      id: pb.id,
      title: pb.breadcrumbs ?? "Playbook",
      category: (pb.metadata?.category as string) ?? pb.sourceType,
      content: pb.content,
      version: (pb.metadata?.version as number) ?? 1,
      updatedAt: pb.updatedAt,
    }));
  },
  ingest: (companyId: string, data: IngestDocumentInput) =>
    api.post<{ records: MemoryRecord[] }>(
      `/companies/${companyId}/memory/ingest`,
      data,
    ),
};
