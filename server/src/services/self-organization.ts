import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, routines, workQueues } from "@paperclipai/db";
import type { OrganizationalProposal } from "@paperclipai/shared";
import { logActivity } from "./activity-log.js";
import { assessApprovalRiskWithLaya } from "./laya-risk-scorer.js";

export function selfOrganizationService(db: Db) {
  return {
    async submitProposal(
      companyId: string,
      agentId: string,
      proposal: OrganizationalProposal,
    ) {
      const riskAssessment = await assessApprovalRiskWithLaya(
        "organizational_proposal",
        proposal as unknown as Record<string, unknown>,
      );

      const [approval] = await db
        .insert(approvals)
        .values({
          companyId,
          type: "organizational_proposal",
          requestedByAgentId: agentId,
          status: "pending",
          payload: {
            proposalType: proposal.type,
            title: proposal.title,
            rationale: proposal.rationale,
            targetAgentId: proposal.targetAgentId ?? null,
            proposedChanges: proposal.proposedChanges,
            proposedAt: new Date().toISOString(),
            riskAssessment,
          },
        })
        .returning();

      await logActivity(db, {
        companyId,
        actorType: "agent",
        actorId: agentId,
        agentId,
        action: "proposal.submitted",
        entityType: "approval",
        entityId: approval.id,
        details: { title: proposal.title, type: proposal.type },
      });

      return approval;
    },

    async applyApprovedProposal(companyId: string, approvalId: string, decidedByUserId: string) {
      const [approval] = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.id, approvalId)))
        .limit(1);

      if (!approval || approval.type !== "organizational_proposal") {
        throw new Error("Invalid organizational proposal approval record");
      }

      if (approval.status !== "pending") {
        throw new Error(`Proposal is already ${approval.status}`);
      }

      const payload = approval.payload as {
        proposalType: string;
        targetAgentId?: string;
        proposedChanges: Record<string, unknown>;
      };

      // Apply the structural mutation based on proposal type
      if (payload.proposalType === "adjust_role" && payload.targetAgentId) {
        const changes: Record<string, unknown> = {};
        if (payload.proposedChanges.instructions) {
          changes.instructions = payload.proposedChanges.instructions;
        }
        if (payload.proposedChanges.role) {
          changes.role = payload.proposedChanges.role;
        }

        if (Object.keys(changes).length > 0) {
          await db
            .update(agents)
            .set({ ...changes, updatedAt: new Date() })
            .where(and(eq(agents.companyId, companyId), eq(agents.id, payload.targetAgentId)));
        }
      } else if (payload.proposalType === "create_routine") {
        const changes = payload.proposedChanges as {
          title: string;
          description?: string;
        };
        await db.insert(routines).values({
          companyId,
          title: changes.title,
          description: changes.description,
          status: "active",
        });
      } else if (payload.proposalType === "rebalance_queue") {
        const changes = payload.proposedChanges as {
          queueKey: string;
          rateLimitPerMinute?: number;
          defaultAssigneeAgentId?: string;
        };
        if (changes.queueKey) {
          const updateFields: Record<string, unknown> = { updatedAt: new Date() };
          if (changes.rateLimitPerMinute !== undefined) {
            updateFields.rateLimitPerMinute = changes.rateLimitPerMinute;
          }
          if (changes.defaultAssigneeAgentId !== undefined) {
            updateFields.defaultAssigneeAgentId = changes.defaultAssigneeAgentId;
          }
          await db
            .update(workQueues)
            .set(updateFields)
            .where(and(eq(workQueues.companyId, companyId), eq(workQueues.key, changes.queueKey)));
        }
      }

      // Mark approval as approved
      const [updated] = await db
        .update(approvals)
        .set({
          status: "approved",
          decidedByUserId,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvals.id, approvalId))
        .returning();

      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: decidedByUserId,
        action: "proposal.approved",
        entityType: "approval",
        entityId: approvalId,
        details: { proposalType: payload.proposalType },
      });

      return updated;
    },

    async listProposals(companyId: string) {
      return db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            eq(approvals.type, "organizational_proposal"),
          ),
        )
        .orderBy(desc(approvals.createdAt));
    },

    async evaluateAndPropose(companyId: string, initiatorAgentId?: string) {
      const companyQueues = await db
        .select()
        .from(workQueues)
        .where(eq(workQueues.companyId, companyId));

      const companyAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.companyId, companyId));

      const proposals: Array<{ proposal: OrganizationalProposal; approval: any }> = [];
      const agentId = initiatorAgentId ?? companyAgents[0]?.id ?? "system";

      for (const queue of companyQueues) {
        if (!queue.defaultAssigneeAgentId && companyAgents.length > 0) {
          const proposed: OrganizationalProposal = {
            type: "rebalance_queue",
            title: `Assign dedicated agent to queue '${queue.name}'`,
            rationale: `Queue '${queue.name}' (${queue.key}) currently has no default assignee. Assigning ${companyAgents[0].name} accelerates triage and dispatch.`,
            proposedChanges: {
              queueKey: queue.key,
              defaultAssigneeAgentId: companyAgents[0].id,
            },
            proposedAt: new Date().toISOString(),
          };
          const approval = await this.submitProposal(companyId, agentId, proposed);
          proposals.push({ proposal: proposed, approval });
          break;
        }
      }

      if (proposals.length === 0) {
        const proposed: OrganizationalProposal = {
          type: "create_routine",
          title: "Automated Daily Triage & Knowledge Distillation Routine",
          rationale: "Periodic institutional learning and queue health sweep maintains high operational tempo without human intervention.",
          proposedChanges: {
            title: "Daily Knowledge & Triage Sweep",
            description: "Sweep active work queues, quarantine dead letters, and consolidate playbook learning.",
          },
          proposedAt: new Date().toISOString(),
        };
        const approval = await this.submitProposal(companyId, agentId, proposed);
        proposals.push({ proposal: proposed, approval });
      }

      return proposals;
    },
  };
}
