import type { TicketOnRampPayload } from "@paperclipai/shared";
import { api } from "./client";

export const ticketOnRampsApi = {
  syncTicket: (companyId: string, payload: TicketOnRampPayload) =>
    api.post<{ issue: unknown; isNew: boolean }>(
      `/companies/${companyId}/ticket-on-ramps/sync`,
      payload,
    ),
  generateOutboundComment: (companyId: string, issueId: string) =>
    api.post<{ mirrorComment: string }>(
      `/companies/${companyId}/ticket-on-ramps/mirror-comment`,
      { issueId },
    ),
};
