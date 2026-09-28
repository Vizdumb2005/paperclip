import type { TicketOnRampPayload, TicketSyncResult } from "@paperclipai/shared";
import { api } from "./client";

// Aligned to the mounted server contract in server/src/routes/ticket-on-ramps.ts
// (tickets/inbound + ticket-on-ramps/mirror-comment). Do not invent new paths
// here without adding the matching server route first.
export const ticketOnRampsApi = {
  syncTicket: (companyId: string, payload: TicketOnRampPayload) =>
    api.post<TicketSyncResult>(`/companies/${companyId}/tickets/inbound`, payload),
  generateOutboundComment: (companyId: string, issueId: string, deliverableUrl?: string) =>
    api.post<{ mirrored: boolean; body: string | null }>(
      `/companies/${companyId}/ticket-on-ramps/mirror-comment`,
      { issueId, deliverableUrl },
    ),
};
