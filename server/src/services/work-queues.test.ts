import { describe, expect, it } from "vitest";
import { classifyWithLaya } from "./work-queues.js";

describe("Work Queues Triage (Laya Decision Model)", () => {
  it("classifies critical crash as critical bug requiring escalation", () => {
    const payload = {
      title: "Production database crash: fatal exception in auth service",
      source: "sentry",
      trace: "Fatal connection timeout to Postgres",
    };

    const classification = classifyWithLaya(payload);

    expect(classification.category).toBe("bug_fix");
    expect(classification.severity).toBe("critical");
    expect(classification.domain).toBe("backend");
    expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    expect(classification.requiresHumanEscalation).toBe(true);
    expect(classification.probabilities?.isCritical).toBe(0.95);
  });

  it("classifies frontend feature request with standard severity", () => {
    const payload = {
      title: "Add dark mode toggle button to settings UI",
      source: "linear",
      component: "react-header",
    };

    const classification = classifyWithLaya(payload);

    expect(classification.category).toBe("feature_request");
    expect(classification.severity).toBe("standard");
    expect(classification.domain).toBe("frontend");
    expect(classification.requiresHumanEscalation).toBe(false);
  });

  it("classifies devops deployment query", () => {
    const payload = {
      title: "Update docker compose and k8s config for staging",
      source: "github-webhook",
    };

    const classification = classifyWithLaya(payload);

    expect(classification.domain).toBe("devops");
    expect(classification.severity).toBe("standard");
  });
});
