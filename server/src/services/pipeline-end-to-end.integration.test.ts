import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  companyMemoryProviders,
  documents,
  externalObjects,
  issues,
  memoryRecords,
  routines,
  workQueueItems,
  workQueues,
  approvals,
} from "@paperclipai/db";
import {
  MaximizerCircuitBreaker,
  verifyRunRequirements,
} from "./index.js";
// Unregistered from the services barrel by design; imported by module path.
import { companyMemoryService } from "./company-memory.js";
import { workQueueService } from "./work-queues.js";
import { organizationalLearningService } from "./organizational-learning.js";
import { selfOrganizationService } from "./self-organization.js";
import { ceoChatService } from "./ceo-chat.js";
import { ticketOnRampService } from "./ticket-on-ramps.js";
import { companyMemoryRoutes } from "../routes/company-memory.js";
import { workQueueRoutes } from "../routes/work-queues.js";
import { ceoChatRoutes } from "../routes/ceo-chat.js";
import { ticketOnRampRoutes } from "../routes/ticket-on-ramps.js";

function createMockDb() {
  const store = {
    companyMemoryProviders: [] as any[],
    memoryRecords: [] as any[],
    workQueues: [] as any[],
    workQueueItems: [] as any[],
    issues: [] as any[],
    externalObjects: [] as any[],
    documents: [] as any[],
    approvals: [] as any[],
    routines: [] as any[],
    activityLog: [] as any[],
  };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

  const mockDb: any = {
    _store: store,
    insert: (table: any) => ({
      values: (val: any) => {
        const row = { id: nextId("id"), createdAt: new Date(), updatedAt: new Date(), ...val };
        if (table === companyMemoryProviders) store.companyMemoryProviders.push(row);
        else if (table === memoryRecords) store.memoryRecords.push(row);
        else if (table === workQueues) store.workQueues.push(row);
        else if (table === workQueueItems) store.workQueueItems.push(row);
        else if (table === issues) store.issues.push(row);
        else if (table === externalObjects) store.externalObjects.push(row);
        else if (table === documents) store.documents.push(row);
        else if (table === approvals) store.approvals.push(row);
        else if (table === routines) store.routines.push(row);

        const promise = Promise.resolve([row]) as any;
        promise.returning = async () => [row];
        return promise;
      },
    }),
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              if (table === companyMemoryProviders) return store.companyMemoryProviders;
              if (table === memoryRecords) return store.memoryRecords;
              if (table === workQueues) return store.workQueues;
              if (table === workQueueItems) return store.workQueueItems;
              if (table === issues) return store.issues;
              if (table === externalObjects) return store.externalObjects;
              if (table === documents) return store.documents;
              if (table === approvals) return store.approvals;
              if (table === routines) return store.routines;
              return [];
            },
          }),
          limit: async () => {
            if (table === companyMemoryProviders) return store.companyMemoryProviders;
            if (table === memoryRecords) return store.memoryRecords;
            if (table === workQueues) return store.workQueues;
            if (table === workQueueItems) return store.workQueueItems;
            if (table === issues) return store.issues;
            if (table === externalObjects) return store.externalObjects;
            if (table === documents) return store.documents;
            if (table === approvals) return store.approvals;
            if (table === routines) return store.routines;
            return [];
          },
        }),
        limit: async () => {
          if (table === companyMemoryProviders) return store.companyMemoryProviders;
          if (table === memoryRecords) return store.memoryRecords;
          return [];
        },
      }),
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: () => ({
          returning: async () => {
            if (table === approvals && store.approvals.length > 0) {
              const item = { ...store.approvals[0], ...updates };
              store.approvals[0] = item;
              return [item];
            }
            if (table === issues && store.issues.length > 0) {
              const item = { ...store.issues[0], ...updates };
              store.issues[0] = item;
              return [item];
            }
            return [{ ...updates, id: "updated-1" }];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async () => [],
    }),
  };

  return mockDb;
}

// Mock activity log to isolate DB writes
vi.mock("./activity-log.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe("Unified Autonomous Control Plane End-to-End Pipeline", () => {
  const companyId = "company-autonomy-test";

  it("executes the complete closed-loop pipeline across all 8 pillars", async () => {
    const db = createMockDb();

    // ==========================================
    // Pillar 1: Intake On-Ramp via BYO Tickets
    // ==========================================
    const ticketService = ticketOnRampService(db);
    const inboundTicketResult = await ticketService.syncInboundTicket(companyId, {
      provider: "linear",
      externalId: "ENG-402",
      title: "Fix Memory Leak in WebSocket Session Pools",
      description: "Sessions remain open after disconnection under high load.",
      url: "https://linear.app/org/issue/ENG-402",
      priority: "high",
    });

    expect(inboundTicketResult.action).toBe("created");
    expect(inboundTicketResult.linkedIssueId).toBeDefined();
    expect(db._store.issues.length).toBe(1);
    const createdIssue = db._store.issues[0];
    expect(createdIssue.title).toContain("[LINEAR ENG-402]");
    expect(createdIssue.priority).toBe("high");

    // ==========================================
    // Pillar 2: Intake via Work Queues & Laya Triage
    // ==========================================
    const queueService = workQueueService(db);
    const triageQueue = await queueService.createQueue(companyId, {
      key: "triage-intake",
      name: "Automated Support Triage",
      rateLimitPerMinute: 60,
      routingPolicy: {
        autoDispatch: true,
        confidenceThreshold: 0.5,
      },
    });

    const queueItem = await queueService.ingest(companyId, "triage-intake", {
      title: "Backend auth API token refresh timeout issue",
      error: "TimeoutException at AuthTokenRefresher.java:88",
    });

    expect(queueItem.classification).toBeDefined();
    expect(queueItem.classification?.domain).toBe("backend");
    expect(queueItem.classification?.category).toBe("bug_fix");
    expect(queueItem.classification?.requiresHumanEscalation).toBe(false);
    expect(db._store.issues.length).toBe(2); // Auto-dispatched a 2nd issue

    // ==========================================
    // Pillar 3: Intake via CEO Chat Interface
    // ==========================================
    const ceoService = ceoChatService(db);
    const ceoPrompt = "We need a plan to improve database query latency and add indexes";
    const actions = ceoService.resolveWorkActions(ceoPrompt);

    expect(actions.length).toBeGreaterThan(0);
    const planAction = actions.find((a) => a.actionType === "plan_decomposition");
    expect(planAction).toBeDefined();

    const executedWork = await ceoService.executeWorkAction(companyId, planAction!);
    expect(executedWork.type).toBe("plan_decomposition");
    expect(db._store.issues.length).toBe(3); // Created parent plan issue

    // ==========================================
    // Pillar 4: Autonomous Execution (MAXIMIZER MODE)
    // ==========================================
    const memoryService = companyMemoryService(db);
    const targetIssueId = createdIssue.id;

    // 4.1 Pre-run context hydration from institutional memory
    const hydratedContext = await memoryService.hydrateAgentContext(
      companyId,
      createdIssue,
    );
    expect(typeof hydratedContext).toBe("string");

    // 4.2 Circuit Breaker verification: detects identical tool call stagnation
    const circuitBreaker = new MaximizerCircuitBreaker();
    const args = { cmd: "npm test" };
    const step1 = circuitBreaker.recordStep("run_command", args);
    const step2 = circuitBreaker.recordStep("run_command", args);
    const step3 = circuitBreaker.recordStep("run_command", args);

    expect(step1.tripped).toBe(false);
    expect(step2.tripped).toBe(false);
    expect(step3.tripped).toBe(true);
    expect(step3.reason).toContain("Stagnation detected");

    // 4.3 Legitimate verified step execution
    const validBreaker = new MaximizerCircuitBreaker();
    validBreaker.recordStep("view_file", { path: "server/src/session.ts" });
    validBreaker.recordStep("replace_file_content", { path: "server/src/session.ts" });
    validBreaker.recordStep("run_command", { cmd: "pnpm test:run" });
    expect(validBreaker.getStepCount()).toBe(3);

    // 4.4 Verification Gate check
    const verifyResult = verifyRunRequirements({
      hasRanVerificationCommand: true,
      verificationOutput: "All 19 tests passed successfully with 0 defects",
      hasDeliverableArtifact: true,
    });

    expect(verifyResult.verified).toBe(true);

    // ==========================================
    // Pillar 5: Automatic Organizational Learning
    // ==========================================
    const learningService = organizationalLearningService(db);
    const distilledPlaybook = await learningService.distillCompletedIssue({
      companyId,
      issueId: targetIssueId,
      issueTitle: createdIssue.title,
      issueDescription: createdIssue.description ?? "Memory leak resolution",
      runSummary: "Replaced unbounded WebSocket connection pool with LRU evicting buffer.",
      toolInvocations: [
        { tool: "replace_file_content", command: "Bounded WebSocket pool" },
        { tool: "run_command", command: "pnpm test:run" },
      ],
      verificationResults: [
        "19/19 unit tests passing",
        "Leak test stress-tested 10,000 cycles with 0 RSS inflation",
      ],
    });

    expect(distilledPlaybook.slug).toContain("playbook-linear-eng-402");
    expect(distilledPlaybook.tier).toBe("consolidated");
    expect(distilledPlaybook.content).toContain("## Verified Solution Recipe");
    expect(db._store.documents.length).toBe(1);

    // ==========================================
    // Pillar 6: Stratum RAG Memory & Recall
    // ==========================================
    // Stratum Hybrid Search immediately recalls the distilled playbook
    const searchResults = await memoryService.search(companyId, {
      query: "WebSocket session pool memory leak",
      limit: 5,
    });
    expect(Array.isArray(searchResults)).toBe(true);

    // Episodic memory logging
    const episodicRecord = await memoryService.recordRunEpisodicMemory(
      companyId,
      "run-001",
      targetIssueId,
      "agent-optimizer",
      "Swapped session map with LRU buffer to fix WebSocket session memory leak. Always register disconnect finalizers in socket listeners.",
    );
    expect(episodicRecord).toBeDefined();
    expect(episodicRecord?.tier).toBe("episodic");
    expect(db._store.memoryRecords.length).toBeGreaterThan(0);

    // ==========================================
    // Pillar 7: Governed Self-Organization
    // ==========================================
    const orgService = selfOrganizationService(db);
    // Agent proposes a structural recurring routine to continuously prevent leaks
    const proposal = await orgService.submitProposal(companyId, "agent-optimizer", {
      type: "create_routine",
      title: "Hourly Session Pool Watchdog",
      rationale: "Detected repeated socket leaks under load; routine inspects socket counts.",
      proposedChanges: {
        title: "Hourly Session Pool Watchdog",
        description: "Scans active socket counts and alerts if leaked",
      },
      proposedAt: new Date().toISOString(),
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.status).toBe("pending");
    expect(db._store.approvals.length).toBe(1);

    // Human operator signs off on the proposal
    const approved = await orgService.applyApprovedProposal(companyId, proposal.id, "user-admin");
    expect(approved.status).toBe("approved");
    expect(db._store.routines.length).toBe(1);
    expect(db._store.routines[0].title).toBe("Hourly Session Pool Watchdog");

    // ==========================================
    // Pillar 8: Outbound Ticket Status Mirror
    // ==========================================
    const mirrorComment = ticketService.formatOutboundMirrorComment(
      {
        id: createdIssue.id,
        title: createdIssue.title,
        status: "done",
      },
      "https://paperclip.local/work/artifacts/report.md",
    );
    expect(mirrorComment).toContain("Paperclip Control Plane Update");
    expect(mirrorComment).toContain("`DONE`");
    expect(mirrorComment).toContain("View Artifact");
  });

  it("verifies HTTP route endpoints for all autonomous surfaces", async () => {
    const db = createMockDb();
    const app = express();
    app.use(express.json());

    // Inject board actor authorization
    app.use((req, _res, next) => {
      req.actor = {
        type: "board",
        userId: "user-test",
        companyIds: [companyId],
        source: "local_implicit",
        isInstanceAdmin: true,
      };
      next();
    });

    app.use("/api", companyMemoryRoutes(db));
    app.use("/api", workQueueRoutes(db));
    app.use("/api", ceoChatRoutes(db));
    app.use("/api", ticketOnRampRoutes(db));

    // 1. CEO Chat Resolve & Execute endpoints
    const resolveRes = await request(app)
      .post(`/api/companies/${companyId}/ceo-chat/resolve`)
      .send({ message: "Create an urgent fix for checkout payment timeouts" })
      .expect(200);

    expect(resolveRes.body.actions).toBeDefined();
    expect(resolveRes.body.actions.length).toBeGreaterThan(0);

    const executeRes = await request(app)
      .post(`/api/companies/${companyId}/ceo-chat/execute`)
      .send({ action: resolveRes.body.actions[0] })
      .expect(201);

    expect(executeRes.body.createdId).toBeDefined();

    // 2. Ticket On-Ramp Webhook endpoint
    const ticketRes = await request(app)
      .post(`/api/companies/${companyId}/tickets/inbound`)
      .send({
        provider: "jira",
        externalId: "PROJ-901",
        title: "Database deadlock in transaction retry loop",
        description: "Replicable during high-concurrency order creation",
      })
      .expect(201);

    expect(ticketRes.body.action).toBe("created");
    expect(ticketRes.body.linkedIssueId).toBeDefined();

    // 3. Work Queue Ingest & Triage endpoint
    await request(app)
      .post(`/api/companies/${companyId}/work-queues`)
      .send({
        key: "inbound-alerts",
        name: "Infrastructure Alerts",
        rateLimitPerMinute: 100,
      })
      .expect(201);

    const queueIngestRes = await request(app)
      .post(`/api/companies/${companyId}/work-queues/inbound-alerts/ingest`)
      .send({
        title: "High CPU usage on search indexing node",
        severity: "critical",
      })
      .expect(201);

    expect(queueIngestRes.body.item).toBeDefined();
    expect(queueIngestRes.body.item.classification).toBeDefined();

    // 4. Company Memory Search endpoint
    const searchRes = await request(app)
      .post(`/api/companies/${companyId}/memory/search`)
      .send({ query: "indexing node" })
      .expect(200);

    expect(Array.isArray(searchRes.body.results)).toBe(true);
  });
});
