import type { Approval, OrganizationalProposal } from "@paperclipai/shared";
import { api } from "./client";

export const selfOrganizationApi = {
  listProposals: (companyId: string) =>
    api.get<{ proposals: Approval[] }>(
      `/companies/${companyId}/self-organization/proposals`,
    ),
  evaluate: (companyId: string) =>
    api.post<{
      proposals: Array<{ proposal: OrganizationalProposal; approval: Approval }>;
    }>(`/companies/${companyId}/self-organization/evaluate`, {}),
  applyProposal: (companyId: string, approvalId: string) =>
    api.post<{ approval: Approval }>(
      `/companies/${companyId}/self-organization/proposals/${approvalId}/apply`,
      {},
    ),
};
