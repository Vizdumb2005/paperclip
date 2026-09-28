import type { TelemetryAdoptionSummary } from "@paperclipai/shared";
import { api } from "./client";

export const telemetryAdoptionApi = {
  summary: (companyId: string) =>
    api.get<TelemetryAdoptionSummary>(`/companies/${companyId}/telemetry-adoption`),
};
