import type { CeoChatTurnResult } from "@paperclipai/shared";
import { api } from "./client";

export const ceoChatApi = {
  sendMessage: (
    companyId: string,
    message: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>,
  ) =>
    api.post<CeoChatTurnResult>(`/companies/${companyId}/ceo-chat/message`, {
      message,
      history,
    }),
  executeAction: (
    companyId: string,
    actionCardId: string,
    actionPayload?: Record<string, unknown>,
  ) =>
    api.post<{ executed: boolean; result: unknown }>(
      `/companies/${companyId}/ceo-chat/actions/${actionCardId}/execute`,
      { actionPayload },
    ),
};
