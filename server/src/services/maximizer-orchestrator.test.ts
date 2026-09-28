import { describe, expect, it } from "vitest";
import { heartbeatRunEvents, heartbeatRuns, issueWorkProducts } from "@paperclipai/db";
import {
  MaximizerCircuitBreaker,
  verifyRunRequirements,
} from "./maximizer-orchestrator.js";
import { runVerificationService } from "./run-verification.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const ISSUE_ID = "22222222-2222-4222-8222-222222222222";

type EventRow = { eventType: string; message: string | null; payload: unknown };
type WorkProductRow = { title: string };

function createMockDb(opts: {
  events?: EventRow[];
  workProducts?: WorkProductRow[];
  runs?: { id: string }[];
}) {
  const store = {
    runs: opts.runs ?? [{ id: "run-1" }],
    events: opts.events ?? ([] as EventRow[]),
    workProducts: opts.workProducts ?? ([] as WorkProductRow[]),
  };

  const mockDb: any = {
    _store: store,
    select: () => ({
      from: (table: any) => {
        const rows: any[] =
          table === issueWorkProducts
            ? store.workProducts
            : table === heartbeatRuns
              ? store.runs
              : store.events;
        const chain: any = {
          where: () => chain,
          orderBy: () => chain,
          limit: async () => rows,
        };
        return chain;
      },
    }),
  };

  return mockDb;
}

describe("Maximizer VERIFY gate evidence collection", () => {
  it("finds no verification evidence when no runs or work products exist", async () => {
    const db = createMockDb({ runs: [] });
    const evidence = await runVerificationService(db).collectVerificationEvidence(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(evidence.hasRanVerificationCommand).toBe(false);
    expect(evidence.hasDeliverableArtifact).toBe(false);
  });

  it("detects a verification command recorded in the run log", async () => {
    const db = createMockDb({
      events: [
        { eventType: "tool_call", message: "running pnpm test", payload: { command: "pnpm test" } },
      ],
    });
    const evidence = await runVerificationService(db).collectVerificationEvidence(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(evidence.hasRanVerificationCommand).toBe(true);
    expect(evidence.verificationCommands.length).toBeGreaterThan(0);
    expect(evidence.hasDeliverableArtifact).toBe(false);
  });

  it("does not treat ordinary file edits as verification", async () => {
    const db = createMockDb({
      events: [
        { eventType: "tool_call", message: "edited src/index.ts", payload: { path: "src/index.ts" } },
      ],
    });
    const evidence = await runVerificationService(db).collectVerificationEvidence(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(evidence.hasRanVerificationCommand).toBe(false);
  });

  it("treats a registered work product as a deliverable artifact", async () => {
    const db = createMockDb({ workProducts: [{ title: "Migration report" }] });
    const evidence = await runVerificationService(db).collectVerificationEvidence(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(evidence.hasDeliverableArtifact).toBe(true);
    expect(evidence.deliverableTitles).toEqual(["Migration report"]);
  });

  it("blocks the gate when neither command nor deliverable exists", async () => {
    const db = createMockDb({
      events: [{ eventType: "tool_call", message: "read a file", payload: null }],
    });
    const gate = await runVerificationService(db).evaluateCompletionGate(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(gate.verified).toBe(false);
    expect(gate.missingRequirement).toContain("requires programmatic verification");
  });

  it("passes the gate when a verification command ran", async () => {
    const db = createMockDb({
      events: [
        { eventType: "tool_call", message: "running pnpm typecheck", payload: { command: "pnpm typecheck" } },
      ],
    });
    const gate = await runVerificationService(db).evaluateCompletionGate(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(gate.verified).toBe(true);
  });

  it("fails the gate when the run log reports a failure signal alongside a command", async () => {
    const db = createMockDb({
      events: [
        { eventType: "tool_call", message: "running pnpm test", payload: { command: "pnpm test" } },
        { eventType: "error", message: "3 tests failed", payload: null },
      ],
    });
    const gate = await runVerificationService(db).evaluateCompletionGate(
      COMPANY_ID,
      ISSUE_ID,
    );
    expect(gate.verified).toBe(false);
  });
});

describe("Maximizer Mode & Circuit Breaker", () => {
  it("allows normal varied tool executions", () => {
    const cb = new MaximizerCircuitBreaker();
    expect(cb.recordStep("read_file", { path: "a.ts" })).toEqual({ tripped: false });
    expect(cb.recordStep("read_file", { path: "b.ts" })).toEqual({ tripped: false });
    expect(cb.recordStep("run_command", { cmd: "npm test" })).toEqual({ tripped: false });
    expect(cb.getStepCount()).toBe(3);
  });

  it("trips circuit breaker on 3 identical consecutive tool calls (stagnation loop)", () => {
    const cb = new MaximizerCircuitBreaker();
    const args = { query: "select * from users" };

    expect(cb.recordStep("db_query", args)).toEqual({ tripped: false });
    expect(cb.recordStep("db_query", args)).toEqual({ tripped: false });

    const result = cb.recordStep("db_query", args);
    expect(result.tripped).toBe(true);
    expect(result.reason).toContain("Stagnation detected");
  });

  it("trips circuit breaker when exceeding max step budget", () => {
    const cb = new MaximizerCircuitBreaker({
      maxRunSteps: 5,
      maxConsecutiveToolFailures: 3,
      verificationRequired: true,
      circuitBreakerThreshold: 3,
    });

    for (let i = 0; i < 5; i++) {
      expect(cb.recordStep(`tool_${i}`, { i })).toEqual({ tripped: false });
    }

    const overLimit = cb.recordStep("tool_6", { i: 6 });
    expect(overLimit.tripped).toBe(true);
    expect(overLimit.reason).toContain("Exceeded maximum autonomous run budget");
  });

  it("trips on consecutive tool failures", () => {
    const cb = new MaximizerCircuitBreaker({
      maxRunSteps: 25,
      maxConsecutiveToolFailures: 3,
      verificationRequired: true,
      circuitBreakerThreshold: 5,
    });

    expect(cb.recordStep("deploy", { env: "prod" }, "failure")).toEqual({ tripped: false });
    expect(cb.recordStep("deploy", { env: "prod" }, "failure")).toEqual({ tripped: false });

    const trip = cb.recordStep("deploy", { env: "prod" }, "failure");
    expect(trip.tripped).toBe(true);
    expect(trip.reason).toContain("failed 3 consecutive times");
  });

  it("enforces verification before allowing terminal completion", () => {
    // Missing verification
    const unverified = verifyRunRequirements({
      hasRanVerificationCommand: false,
      hasDeliverableArtifact: false,
    });
    expect(unverified.verified).toBe(false);
    expect(unverified.missingRequirement).toContain("requires programmatic verification");

    // Verification output had error
    const failedVerification = verifyRunRequirements({
      hasRanVerificationCommand: true,
      verificationOutput: "Test suite failed with 2 errors",
      hasDeliverableArtifact: true,
    });
    expect(failedVerification.verified).toBe(false);
    expect(failedVerification.missingRequirement).toContain("output indicates failure");

    // Passed verification
    const passed = verifyRunRequirements({
      hasRanVerificationCommand: true,
      verificationOutput: "All 15 tests passed",
      hasDeliverableArtifact: true,
    });
    expect(passed.verified).toBe(true);
  });
});
