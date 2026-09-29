import { describe, expect, it } from "vitest";
import { LayaDecisionEngine, defaultLayaEngine } from "./laya-engine.js";

describe("LayaDecisionEngine", () => {
  it("evaluates choice, score, and boolean questions with calibrated latency and probability", async () => {
    const engine = new LayaDecisionEngine();

    const state = {
      title: "Fatal memory leak in database pool during checkout",
      service: "payment-gateway",
      reportedBy: "customer-success",
      errorCode: "OOM_KILLED_PG_CONN",
      impact: "Checkout is failing for all users in EU-Central",
    };

    const result = await engine.decide(state, [
      {
        id: "domain",
        type: "choice",
        question: "Which domain owns this problem?",
        options: ["frontend", "backend", "devops", "product"] as const,
      },
      {
        id: "severity",
        type: "choice",
        question: "What is the severity level?",
        options: ["critical", "high", "standard", "low"] as const,
      },
      {
        id: "risk_score",
        type: "score",
        question: "Rate the operational risk from 0 to 100",
        min: 0,
        max: 100,
      },
      {
        id: "escalate",
        type: "boolean",
        question: "Does this require immediate human managerial escalation?",
      },
    ]);

    expect(result.latencyMs).toBeLessThan(100);
    expect(result.source).toBe("local_calibrated");

    // Domain evaluation
    const domainAnswer = result.answers["domain"];
    expect(domainAnswer.type).toBe("choice");
    if (domainAnswer.type === "choice") {
      expect(domainAnswer.answer).toBe("backend");
      expect(domainAnswer.probability).toBeGreaterThan(0.25);
    }

    // Severity evaluation
    const severityAnswer = result.answers["severity"];
    expect(severityAnswer.type).toBe("choice");
    if (severityAnswer.type === "choice") {
      expect(severityAnswer.answer).toBe("critical");
      expect(severityAnswer.probability).toBeGreaterThan(0.3);
    }

    // Score evaluation
    const scoreAnswer = result.answers["risk_score"];
    expect(scoreAnswer.type).toBe("score");
    if (scoreAnswer.type === "score") {
      expect(scoreAnswer.score).toBeGreaterThan(0);
      expect(scoreAnswer.confidence).toBeGreaterThan(0.8);
    }

    // Boolean evaluation
    const escalateAnswer = result.answers["escalate"];
    expect(escalateAnswer.type).toBe("boolean");
    if (escalateAnswer.type === "boolean") {
      expect(escalateAnswer.answer).toBe(true);
      expect(escalateAnswer.probability).toBeGreaterThan(0.8);
    }
  });

  it("handles low-severity benign inputs correctly", async () => {
    const state = {
      title: "Update button color scheme to match spring brand refresh",
      service: "marketing-landing-page",
    };

    const result = await defaultLayaEngine.decide(state, [
      {
        id: "domain",
        type: "choice",
        question: "Which domain owns this problem?",
        options: ["frontend", "backend", "devops"] as const,
      },
      {
        id: "escalate",
        type: "boolean",
        question: "Does this require immediate human escalation?",
      },
    ]);

    const domain = result.answers["domain"];
    if (domain.type === "choice") {
      expect(domain.answer).toBe("frontend");
    }

    const escalate = result.answers["escalate"];
    if (escalate.type === "boolean") {
      expect(escalate.answer).toBe(false);
    }
  });
});
