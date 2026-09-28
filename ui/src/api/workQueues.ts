import type { WorkQueue, WorkQueueItem } from "@paperclipai/shared";
import { api } from "./client";

export const workQueuesApi = {
  list: (companyId: string) =>
    api.get<{ queues: WorkQueue[] }>(`/companies/${companyId}/work-queues`),
  get: (companyId: string, key: string) =>
    api.get<{ queue: WorkQueue }>(`/companies/${companyId}/work-queues/${key}`),
  create: (companyId: string, data: Partial<WorkQueue>) =>
    api.post<{ queue: WorkQueue }>(`/companies/${companyId}/work-queues`, data),
  ingest: (companyId: string, key: string, payload: unknown) =>
    api.post<{ item: WorkQueueItem }>(`/companies/${companyId}/work-queues/${key}/ingest`, payload),
  listItems: (companyId: string, key: string, status?: string) =>
    api.get<{ items: WorkQueueItem[] }>(
      `/companies/${companyId}/work-queues/${key}/items${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  replayDlq: (companyId: string, key: string, itemId: string) =>
    api.post<{ item: WorkQueueItem }>(
      `/companies/${companyId}/work-queues/${key}/items/${itemId}/replay`,
      {},
    ),
};
