import { describe, expect, it, vi } from "vitest";
import { selfOrganizationService } from "./self-organization.js";

vi.mock("./activity-log.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe("selfOrganizationService", () => {
  it("submits an organizational proposal as a pending approval gate", async () => {
    const mockDb: any = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "appr-1" }]),
        }),
      }),
    };

    const service = selfOrganizationService(mockDb);
    const result = await service.submitProposal("comp-1", "agent-ceo", {
      type: "adjust_role",
      title: "Adjust triage agent permissions",
      rationale: "Queue volume increased by 200%",
      targetAgentId: "agent-triage",
      proposedChanges: { role: "lead_triage" },
      proposedAt: new Date().toISOString(),
    });

    expect(result.id).toBe("appr-1");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("applies an approved proposal to the database and logs activity", async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "appr-1",
                companyId: "comp-1",
                type: "organizational_proposal",
                status: "pending",
                payload: {
                  proposalType: "create_routine",
                  proposedChanges: {
                    title: "Hourly Queue Rebalance",
                    description: "Recheck queue capacities",
                  },
                },
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "routine-1" }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: "appr-1", status: "approved" },
            ]),
          }),
        }),
      }),
    };

    const service = selfOrganizationService(mockDb);
    const updated = await service.applyApprovedProposal("comp-1", "appr-1", "user-admin");
    expect(updated.status).toBe("approved");
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("evaluates organization structure and proposes queue rebalancing when assignee is missing", async () => {
    const mockDb: any = {
      select: vi.fn()
        // First call: workQueues
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { key: "triage-q", name: "Triage Queue", defaultAssigneeAgentId: null },
            ]),
          }),
        })
        // Second call: agents
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "agent-lead", name: "Lead Agent" },
            ]),
          }),
        }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "appr-new-proposal" }]),
        }),
      }),
    };

    const service = selfOrganizationService(mockDb);
    const proposals = await service.evaluateAndPropose("comp-1");

    expect(proposals).toHaveLength(1);
    expect(proposals[0].proposal.type).toBe("rebalance_queue");
    expect(proposals[0].proposal.proposedChanges.defaultAssigneeAgentId).toBe("agent-lead");
    expect(proposals[0].approval.id).toBe("appr-new-proposal");
  });
});
