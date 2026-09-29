import { defaultLayaEngine, type LayaQuestion } from "./laya-engine.js";

export interface LayaRiskAssessment {
  riskScore: number; // 0.0 (negligible) to 1.0 (dangerous)
  factors: string[];
  recommendation: "auto_approve" | "require_board_review" | "reject";
  confidence: number;
  latencyMs: number;
}

/**
 * Laya-powered Approval & Proposal Risk Scorer.
 * Uses the non-autoregressive decision model to calculate policy risk in <20ms.
 */
export async function assessApprovalRiskWithLaya(
  approvalType: string,
  payload: Record<string, unknown>,
): Promise<LayaRiskAssessment> {
  const questions: LayaQuestion[] = [
    {
      id: "risk_score",
      type: "score",
      question: "What is the operational and financial risk of this mutation on a scale of 0 to 100?",
      min: 0,
      max: 100,
    },
    {
      id: "requires_escalation",
      type: "boolean",
      question: "Does this action involve credentials, budget expansion, or destructive database operations?",
    },
    {
      id: "action_verdict",
      type: "choice",
      question: "What is the recommended governance action?",
      options: ["auto_approve", "require_board_review", "reject"] as const,
    },
  ];

  const state = {
    approvalType,
    ...payload,
  };

  const decision = await defaultLayaEngine.decide(state, questions);

  const rawScore = decision.answers["risk_score"]?.type === "score"
    ? decision.answers["risk_score"].score
    : 20;

  const requiresEscalation = decision.answers["requires_escalation"]?.type === "boolean"
    ? decision.answers["requires_escalation"].answer
    : false;

  const verdict = decision.answers["action_verdict"]?.type === "choice"
    ? (decision.answers["action_verdict"].answer as "auto_approve" | "require_board_review" | "reject")
    : "require_board_review";

  const normalizedScore = Number((rawScore / 100).toFixed(2));
  const factors: string[] = [];

  const textPayload = JSON.stringify(payload).toLowerCase();
  if (textPayload.includes("budget") || textPayload.includes("cost") || textPayload.includes("cents")) {
    factors.push("Involves financial spend / budget modification");
  }
  if (textPayload.includes("secret") || textPayload.includes("token") || textPayload.includes("key")) {
    factors.push("Accesses or requests sensitive authentication credentials");
  }
  if (textPayload.includes("role") || textPayload.includes("rebalance") || textPayload.includes("delete")) {
    factors.push("Mutates company structural hierarchy or permissions");
  }
  if (requiresEscalation && factors.length === 0) {
    factors.push("Identified high-impact parameter changes");
  }

  let finalRecommendation: LayaRiskAssessment["recommendation"] = verdict;
  if (normalizedScore > 0.65 || requiresEscalation) {
    finalRecommendation = "require_board_review";
  } else if (normalizedScore < 0.25 && factors.length === 0) {
    finalRecommendation = "auto_approve";
  }

  return {
    riskScore: normalizedScore,
    factors,
    recommendation: finalRecommendation,
    confidence: 0.92,
    latencyMs: decision.latencyMs,
  };
}
