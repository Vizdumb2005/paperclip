import crypto from "node:crypto";
import type {
  MaximizerCircuitBreakerResult,
  MaximizerPolicy,
  MaximizerStepTrace,
} from "@paperclipai/shared";

export const DEFAULT_MAXIMIZER_POLICY: MaximizerPolicy = {
  maxRunSteps: 25,
  maxConsecutiveToolFailures: 3,
  verificationRequired: true,
  circuitBreakerThreshold: 3,
};

export class MaximizerCircuitBreaker {
  private history: MaximizerStepTrace[] = [];
  private consecutiveFailures = 0;

  constructor(private readonly policy: MaximizerPolicy = DEFAULT_MAXIMIZER_POLICY) {}

  recordStep(
    toolName: string,
    args: unknown,
    outcome: "success" | "failure" = "success",
  ): MaximizerCircuitBreakerResult {
    // 1. Check max steps budget
    if (this.history.length >= this.policy.maxRunSteps) {
      return {
        tripped: true,
        reason: `Exceeded maximum autonomous run budget of ${this.policy.maxRunSteps} steps without completion.`,
      };
    }

    // 2. Track consecutive failures
    if (outcome === "failure") {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.policy.maxConsecutiveToolFailures) {
        return {
          tripped: true,
          reason: `Tool execution failed ${this.consecutiveFailures} consecutive times. Circuit breaker activated to prevent spending loop.`,
        };
      }
    } else {
      this.consecutiveFailures = 0;
    }

    // 3. Detect identical parameter stagnation loops
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(args ?? {}))
      .digest("hex")
      .slice(0, 16);

    this.history.push({
      toolName,
      argumentsHash: hash,
      timestamp: Date.now(),
    });

    if (this.history.length >= this.policy.circuitBreakerThreshold) {
      const recent = this.history.slice(-this.policy.circuitBreakerThreshold);
      const isIdentical = recent.every(
        (trace) => trace.toolName === toolName && trace.argumentsHash === hash,
      );
      if (isIdentical) {
        return {
          tripped: true,
          reason: `Stagnation detected: tool '${toolName}' invoked ${this.policy.circuitBreakerThreshold} consecutive times with identical arguments.`,
        };
      }
    }

    return { tripped: false };
  }

  getStepCount(): number {
    return this.history.length;
  }

  reset(): void {
    this.history = [];
    this.consecutiveFailures = 0;
  }
}

/**
 * Validates that an autonomous run has satisfied all verification requirements
 * (e.g. tests passed, verification commands run) before allowing terminal 'done' transition.
 */
export function verifyRunRequirements(
  evidence: {
    hasRanVerificationCommand: boolean;
    verificationOutput?: string;
    hasDeliverableArtifact: boolean;
  },
  policy: MaximizerPolicy = DEFAULT_MAXIMIZER_POLICY,
): { verified: boolean; missingRequirement?: string } {
  if (!policy.verificationRequired) {
    return { verified: true };
  }

  if (!evidence.hasRanVerificationCommand && !evidence.hasDeliverableArtifact) {
    return {
      verified: false,
      missingRequirement:
        "Maximizer Mode requires programmatic verification (automated test/build/lint command or deliverable file verification) before marking task complete.",
    };
  }

  if (
    evidence.verificationOutput &&
    (evidence.verificationOutput.toLowerCase().includes("failed") ||
      evidence.verificationOutput.toLowerCase().includes("error"))
  ) {
    return {
      verified: false,
      missingRequirement: `Verification command output indicates failure: ${evidence.verificationOutput.slice(0, 150)}`,
    };
  }

  return { verified: true };
}
