import { describe, expect, it } from "vitest";
import type { TelemetryAdoptionSummary } from "@paperclipai/shared";
import { isAdoptionEmpty } from "./TelemetryAdoption";

function summary(totals: number[]): TelemetryAdoptionSummary {
  return {
    companyId: "company-1",
    generatedAt: new Date().toISOString(),
    windowDays: 14,
    events: totals.map((total, index) => ({
      event: `agent.created` as const,
      proxySource: index < 13 ? "agents.created_at" : null,
      total,
      byDay: [{ date: "2026-09-27", count: total }],
    })),
  };
}

describe("isAdoptionEmpty", () => {
  it("is empty when every event count is zero", () => {
    expect(isAdoptionEmpty(summary(Array(15).fill(0)))).toBe(true);
  });

  it("is not empty when any event has a count", () => {
    expect(isAdoptionEmpty(summary([0, 0, 3, ...Array(12).fill(0)]))).toBe(false);
  });
});
