export type WorkQueueItemStatus =
  | "queued"
  | "processing"
  | "completed"
  | "dead_letter"
  | "rejected";

export interface LayaClassification {
  category: string;
  severity: "critical" | "high" | "standard" | "low";
  domain: "frontend" | "backend" | "devops" | "product" | "general";
  confidence: number;
  requiresHumanEscalation: boolean;
  probabilities?: Record<string, number>;
}

export interface WorkQueueRoutingPolicy {
  autoDispatch: boolean;
  confidenceThreshold: number;
  targetProjectId?: string;
  priorityMapping?: Record<string, string>;
  quarantineMalformed?: boolean;
}

export interface WorkQueue {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description?: string | null;
  routingPolicy: WorkQueueRoutingPolicy;
  rateLimitPerMinute: number;
  defaultAssigneeAgentId?: string | null;
  createdAt: Date | string;
}

export interface WorkQueueItem {
  id: string;
  queueId: string;
  companyId: string;
  status: WorkQueueItemStatus;
  payload: Record<string, unknown>;
  classification?: LayaClassification | null;
  linkedIssueId?: string | null;
  retryCount: number;
  errorMessage?: string | null;
  createdAt: Date | string;
  processedAt?: Date | string | null;
}
