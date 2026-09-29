import { api } from "./client";

export interface CloudRelayExportPayload {
  bucket: string;
  prefix: string;
  includeArtifacts?: boolean;
}

export interface CloudRelayImportPayload {
  bucket: string;
  prefix: string;
  manifestSha256?: string;
  targetCompanyId?: string;
  collisionStrategy?: "skip" | "rename" | "overwrite";
}

export interface CloudRelayTransferResult {
  transferId: string;
  status: "completed" | "failed" | "in_progress";
  bucket: string;
  prefix: string;
  partsTotal: number;
  partsCompleted: number;
  companyId?: string;
  error?: string;
}

export const cloudRelayApi = {
  exportToRelay: (companyId: string, payload: CloudRelayExportPayload) =>
    api.post<CloudRelayTransferResult>(`/companies/${companyId}/export/relay`, payload),

  importFromRelay: (payload: CloudRelayImportPayload) =>
    api.post<CloudRelayTransferResult>("/companies/import/relay", payload),

  getTransferStatus: (transferId: string) =>
    api.get<CloudRelayTransferResult>(`/companies/transfers/${transferId}/status`),
};
