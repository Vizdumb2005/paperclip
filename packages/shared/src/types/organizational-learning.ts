export interface PlaybookDistillationInput {
  companyId: string;
  issueId: string;
  issueTitle: string;
  issueDescription?: string | null;
  runSummary?: string | null;
  toolInvocations?: { tool: string; command?: string }[];
  verificationResults?: string[];
}

export interface PlaybookDistillationResult {
  documentId?: string;
  slug: string;
  title: string;
  content: string;
  tier: "consolidated" | "promoted";
  metadata: Record<string, unknown>;
}
