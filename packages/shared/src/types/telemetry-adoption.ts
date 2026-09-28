import type { PaperclipEventName } from "../telemetry/generated/paperclip-telemetry.js";

export interface TelemetryAdoptionDayBucket {
  date: string;
  count: number;
}

/**
 * One of the 15 first-party telemetry events rendered from already-collected,
 * company-scoped local data. `proxySource` names the local table/column the
 * count is derived from — telemetry itself is sent to the external ingest
 * endpoint and is never stored locally, so this view is a read-only adoption
 * proxy, not a telemetry query surface. Entries with `proxySource: null` are
 * instance-level events with no company-scoped proxy.
 */
export interface TelemetryAdoptionEventEntry {
  event: PaperclipEventName;
  proxySource: string | null;
  total: number;
  byDay: TelemetryAdoptionDayBucket[];
}

export interface TelemetryAdoptionSummary {
  companyId: string;
  generatedAt: string;
  windowDays: number;
  events: TelemetryAdoptionEventEntry[];
}
