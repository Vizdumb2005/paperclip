import { describe, expect, it } from "vitest";
import { parseCeoWorkActions } from "./ceo-chat.js";

describe("CEO Chat Work-Object Resolver", () => {
  it("resolves directive to create an issue", () => {
    const message = "Fix the login session expiry bug in the auth service";
    const actions = parseCeoWorkActions(message);

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe("draft_issue");
    expect(actions[0].title).toBe("Fix the login session expiry bug in the auth service");
    expect(actions[0].confidence).toBeGreaterThan(0.8);
  });

  it("resolves plan breakdown into plan decomposition", () => {
    const message = "Let's plan the migration to PostgreSQL with a 3 phase roadmap";
    const actions = parseCeoWorkActions(message);

    const planAction = actions.find((a) => a.actionType === "plan_decomposition");
    expect(planAction).toBeDefined();
    expect(planAction?.payload).toHaveProperty("suggestedPhases");
    expect((planAction?.payload as any).suggestedPhases.length).toBeGreaterThan(1);
  });

  it("resolves production authorization into an approval request", () => {
    const message = "Please approve and deploy to prod the new billing system";
    const actions = parseCeoWorkActions(message);

    const approvalAction = actions.find((a) => a.actionType === "approval_request");
    expect(approvalAction).toBeDefined();
    expect(approvalAction?.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
