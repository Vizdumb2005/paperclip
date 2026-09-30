import { describe, expect, it } from "vitest";
import {
  instanceExperimentalSettingsSchema,
  patchInstanceExperimentalSettingsSchema,
} from "./instance.js";

describe("instance experimental settings validators", () => {
  it("defaults chat connectors on independently of Apps and accepts only explicit boolean patches", () => {
    expect(instanceExperimentalSettingsSchema.parse({}).enableChatConnectors).toBe(true);
    expect(instanceExperimentalSettingsSchema.parse({ enableApps: true }).enableChatConnectors).toBe(true);
    expect(patchInstanceExperimentalSettingsSchema.parse({ enableChatConnectors: true }))
      .toEqual({ enableChatConnectors: true });
    expect(patchInstanceExperimentalSettingsSchema.parse({ enableChatConnectors: false }))
      .toEqual({ enableChatConnectors: false });
    expect(patchInstanceExperimentalSettingsSchema.safeParse({ enableChatConnectors: "true" }).success).toBe(false);
  });
  it("defaults the streamlined UI on and accepts an explicit patch", () => {
    expect(instanceExperimentalSettingsSchema.parse({}).enableStreamlinedUi).toBe(true);
    expect(
      patchInstanceExperimentalSettingsSchema.parse({ enableStreamlinedUi: false }),
    ).toEqual({ enableStreamlinedUi: false });
  });

  it("defaults the server info debug view on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableServerInfoDebugView).toBe(true);
  });

  it("defaults Paperclip developer mode on and accepts explicit patches", () => {
    expect(instanceExperimentalSettingsSchema.parse({}).enablePaperclipDeveloperMode).toBe(true);
    expect(
      patchInstanceExperimentalSettingsSchema.parse({ enablePaperclipDeveloperMode: false }),
    ).toEqual({ enablePaperclipDeveloperMode: false });
  });

  it("strips retired watchdog and liveness auto-recovery settings", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableTaskWatchdogs: false,
        enableIssueGraphLivenessAutoRecovery: true,
        issueGraphLivenessAutoRecoveryLookbackHours: 24,
      }),
    ).toEqual({});
  });

  it("defaults workspace branch repair settings on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableWorkspaceBranchReconcileForward).toBe(true);
    expect(settings.enableWorkspaceDirtyQuarantineRepair).toBe(true);
  });

  it("defaults the goals sidebar link on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableGoalsSidebarLink).toBe(true);
  });

  it("defaults the sandbox duplex bridge on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableSandboxDuplexBridge).toBe(true);
  });

  it("accepts an explicit sandbox duplex bridge kill switch value", () => {
    expect(
      instanceExperimentalSettingsSchema.parse({ enableSandboxDuplexBridge: true })
        .enableSandboxDuplexBridge,
    ).toBe(true);
    expect(
      instanceExperimentalSettingsSchema.parse({ enableSandboxDuplexBridge: false })
        .enableSandboxDuplexBridge,
    ).toBe(false);
  });

  it("accepts the sandbox duplex bridge kill switch in a patch", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({ enableSandboxDuplexBridge: true }),
    ).toEqual({ enableSandboxDuplexBridge: true });
  });

  it("defaults worktree run execution on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableWorktreeRunExecution).toBe(true);
    expect(settings.worktreeRunExecutionActivatedAt).toBeNull();
    expect(settings.worktreeRunExecutionActivationInstanceId).toBeNull();
  });

  it("strips server-managed worktree run execution fields from patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableWorktreeRunExecution: true,
        worktreeRunExecutionActivatedAt: "2026-07-10T12:00:00.000Z",
        worktreeRunExecutionActivationInstanceId: "copied-instance",
      }),
    ).toEqual({
      enableWorktreeRunExecution: true,
    });
  });

  it("defaults built-in agents on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableBuiltInAgents).toBe(true);
  });

  it("defaults beta skills on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableBetaSkills).toBe(true);
  });

  it("defaults the retired Apps compatibility key on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableApps).toBe(true);
  });

  it("accepts worktree run execution patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableWorktreeRunExecution: true,
      }),
    ).toEqual({
      enableWorktreeRunExecution: true,
    });
  });

  it("defaults the decisions sidebar link on", () => {
    const settings = instanceExperimentalSettingsSchema.parse({});

    expect(settings.enableDecisions).toBe(true);
  });

  it("accepts decisions patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableDecisions: true,
      }),
    ).toEqual({
      enableDecisions: true,
    });
  });

  it("accepts server info debug view patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableServerInfoDebugView: true,
      }),
    ).toEqual({
      enableServerInfoDebugView: true,
    });
  });

  it("accepts workspace branch forward reconciliation patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableWorkspaceBranchReconcileForward: false,
        enableWorkspaceDirtyQuarantineRepair: false,
      }),
    ).toEqual({
      enableWorkspaceBranchReconcileForward: false,
      enableWorkspaceDirtyQuarantineRepair: false,
    });
  });

  it("accepts goals sidebar link patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableGoalsSidebarLink: true,
      }),
    ).toEqual({
      enableGoalsSidebarLink: true,
    });
  });

  it("accepts built-in agents patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableBuiltInAgents: true,
      }),
    ).toEqual({
      enableBuiltInAgents: true,
    });
  });

  it("accepts apps patches", () => {
    expect(
      patchInstanceExperimentalSettingsSchema.parse({
        enableApps: true,
      }),
    ).toEqual({
      enableApps: true,
    });
  });
});
