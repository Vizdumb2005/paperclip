export type OrganizationalProposalType =
  | "adjust_role"
  | "create_routine"
  | "rebalance_queue";

export interface OrganizationalProposal {
  type: OrganizationalProposalType;
  title: string;
  rationale: string;
  targetAgentId?: string;
  proposedChanges: Record<string, unknown>;
  proposedAt: Date | string;
}
