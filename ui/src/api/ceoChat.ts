import type { ResolvedWorkAction } from "@paperclipai/shared";
import { api } from "./client";

// Aligned to the mounted server contract in server/src/routes/ceo-chat.ts
// (resolve + execute). Do not invent new paths here without adding the
// matching server route first.
export const ceoChatApi = {
  resolveActions: (companyId: string, message: string) =>
    api.post<{ actions: ResolvedWorkAction[] }>(`/companies/${companyId}/ceo-chat/resolve`, {
      message,
    }),
  executeAction: (companyId: string, action: ResolvedWorkAction) =>
    api.post<{ createdId: string; type: ResolvedWorkAction["actionType"] }>(
      `/companies/${companyId}/ceo-chat/execute`,
      { action },
    ),
};
