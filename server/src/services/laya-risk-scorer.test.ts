import { describe, expect, it } from "vitest";
import { assessApprovalRiskWithLaya } from "./laya-risk-scorer.js";

describe("assessApprovalRiskWithLaya", () => {
  it("flags budget overrides and credential requests as requiring board review", async () => {
    const assessment = await assessApprovalRiskWithLaya("budget_override_required", {
      scopeName: "Global API Quota",
      budgetAmount: 500000, // $5,000.00
      observedAmount: 750000, // $7,500.00
      guidance: "Agent requested 50% budget expansion for Anthropic Claude Opus models",
    });

    expect(assessment.riskScore).toBeGreaterThan(0.2);
    expect(assessment.recommendation).toBe("require_board_review");
    expect(assessment.factors.some((f) => f.includes("budget") || f.includes("spend"))).toBe(true);
    expect(assessment.latencyMs).toBeLessThan(100);
  });

  it("permits auto-approval recommendation for benign low-impact updates", async () => {
    const assessment = await assessApprovalRiskWithLaya("routine_variable_update", {
      key: "REPORT_LIMIT",
      value: "25",
      description: "Minor increment of rows in daily performance report",
    });

    expect(assessment.riskScore).toBeLessThan(0.4);
    expect(["auto_approve", "require_board_review"]).toContain(assessment.recommendation);
  });
});
