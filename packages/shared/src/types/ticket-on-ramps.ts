export type TicketProvider = "linear" | "jira" | "asana";

export interface ExternalTicketPayload {
  provider: TicketProvider;
  externalId: string;
  title: string;
  description?: string;
  url?: string;
  status?: string;
  priority?: string;
  assigneeEmail?: string;
}

export interface TicketSyncResult {
  linkedIssueId: string;
  externalId: string;
  provider: TicketProvider;
  action: "created" | "updated";
}

export type TicketOnRampPayload = ExternalTicketPayload;

