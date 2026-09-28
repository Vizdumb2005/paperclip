export type WorkActionType =
  | "draft_issue"
  | "plan_decomposition"
  | "approval_request";

export interface ResolvedWorkAction {
  actionType: WorkActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  confidence: number;
}

export interface CeoChatTurnResult {
  reply: string;
  actionCards?: ResolvedWorkAction[];
}

