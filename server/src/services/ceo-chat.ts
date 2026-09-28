import type { Db } from "@paperclipai/db";
import { approvals, issues } from "@paperclipai/db";
import type { ResolvedWorkAction, WorkActionType } from "@paperclipai/shared";

export function parseCeoWorkActions(message: string): ResolvedWorkAction[] {
  const lower = message.toLowerCase();
  const actions: ResolvedWorkAction[] = [];

  // Check plan decomposition intent
  if (
    lower.includes("plan") ||
    lower.includes("roadmap") ||
    lower.includes("phase") ||
    lower.includes("break down") ||
    lower.includes("steps")
  ) {
    actions.push({
      actionType: "plan_decomposition",
      title: `Plan: ${message.slice(0, 60).trim()}...`,
      summary: "High-level initiative detected. Proposing structured plan decomposition.",
      confidence: 0.9,
      payload: {
        rawMessage: message,
        suggestedPhases: [
          "Phase 1: Architecture & Specification",
          "Phase 2: Core Service Implementation & Testing",
          "Phase 3: Rollout & Verification",
        ],
      },
    });
  }

  // Check approval intent
  if (
    lower.includes("approve") ||
    lower.includes("deploy to prod") ||
    lower.includes("increase budget") ||
    lower.includes("grant access")
  ) {
    actions.push({
      actionType: "approval_request",
      title: `Approval Request: ${message.slice(0, 50).trim()}`,
      summary: "Action requires executive authorization before execution.",
      confidence: 0.95,
      payload: {
        requestText: message,
        type: "executive_signoff",
      },
    });
  }

  // Default / Issue Creation intent
  if (
    lower.includes("create") ||
    lower.includes("issue") ||
    lower.includes("bug") ||
    lower.includes("fix") ||
    lower.includes("build") ||
    actions.length === 0
  ) {
    const title = message.split("\n")[0].slice(0, 80).trim();
    actions.push({
      actionType: "draft_issue",
      title: title.startsWith("#") ? title.replace(/^#+\s*/, "") : title,
      summary: "Actionable request identified. Proposing task for the company backlog.",
      confidence: 0.85,
      payload: {
        title,
        description: message,
        priority: lower.includes("urgent") || lower.includes("critical") ? "high" : "medium",
      },
    });
  }

  return actions;
}

export function ceoChatService(db: Db) {
  return {
    resolveWorkActions(message: string): ResolvedWorkAction[] {
      return parseCeoWorkActions(message);
    },

    async executeWorkAction(
      companyId: string,
      action: ResolvedWorkAction,
      userId?: string,
    ): Promise<{ createdId: string; type: WorkActionType }> {
      if (action.actionType === "draft_issue") {
        const payload = action.payload as { title: string; description: string; priority?: string };
        const [newIssue] = await db
          .insert(issues)
          .values({
            companyId,
            title: payload.title,
            description: payload.description,
            status: "todo",
            priority: (payload.priority as any) ?? "medium",
          })
          .returning();
        return { createdId: newIssue.id, type: "draft_issue" };
      }

      if (action.actionType === "approval_request") {
        const payload = action.payload as Record<string, unknown>;
        const [appr] = await db
          .insert(approvals)
          .values({
            companyId,
            type: "ceo_chat_authorization",
            requestedByUserId: userId ?? "executive",
            status: "pending",
            payload,
          })
          .returning();
        return { createdId: appr.id, type: "approval_request" };
      }

      // Plan decomposition: creates parent issue
      const payload = action.payload as { rawMessage: string; suggestedPhases: string[] };
      const [parentIssue] = await db
        .insert(issues)
        .values({
          companyId,
          title: action.title,
          description: [
            payload.rawMessage,
            "",
            "### Suggested Phases",
            ...payload.suggestedPhases.map((p) => `- [ ] ${p}`),
          ].join("\n"),
          status: "todo",
          priority: "high",
        })
        .returning();

      return { createdId: parentIssue.id, type: "plan_decomposition" };
    },
  };
}
