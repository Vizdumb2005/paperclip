export type MaximizerState = "THINK" | "CALL" | "VERIFY" | "FINAL" | "BLOCKED";

export interface MaximizerStepTrace {
  toolName: string;
  argumentsHash: string;
  timestamp: number;
}

export interface MaximizerCircuitBreakerResult {
  tripped: boolean;
  reason?: string;
}

export interface MaximizerPolicy {
  maxRunSteps: number;
  maxConsecutiveToolFailures: number;
  verificationRequired: boolean;
  circuitBreakerThreshold: number;
}

/**
 * Evidence gathered from a run before an autonomous issue may be terminalized.
 * Produced by `collectVerificationEvidence` in `run-verification.ts`.
 */
export interface VerificationEvidence {
  hasRanVerificationCommand: boolean;
  verificationOutput?: string;
  hasDeliverableArtifact: boolean;
  /** Tool/command pairs that matched a known verification command. */
  verificationCommands: string[];
  /** Work product titles registered against the issue. */
  deliverableTitles: string[];
  runIds: string[];
}

export interface VerificationGateResult {
  verified: boolean;
  missingRequirement?: string;
  evidence: VerificationEvidence;
}
