import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRunEvents, heartbeatRuns, issueWorkProducts } from "@paperclipai/db";
import type {
  MaximizerPolicy,
  VerificationEvidence,
  VerificationGateResult,
} from "@paperclipai/shared";
import {
  DEFAULT_MAXIMIZER_POLICY,
  verifyRunRequirements,
} from "./maximizer-orchestrator.js";

/**
 * Command fragments that count as programmatic verification for a run.
 * A run that only read files and edited code has not verified anything.
 */
const VERIFICATION_COMMAND_PATTERNS: RegExp[] = [
  /\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?test\b/,
  /\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?lint\b/,
  /\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?typecheck\b/,
  /\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?build\b/,
  /\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?check\b/,
  /\bvitest\b/,
  /\bjest\b/,
  /\bpytest\b/,
  /\bgo\s+test\b/,
  /\bcargo\s+test\b/,
  /\btsc\b/,
  /\beslint\b/,
  /\bruff\b/,
  /\bmypy\b/,
];

function looksLikeVerificationCommand(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return VERIFICATION_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized));
}

function readEventText(
  payload: unknown,
  message: string | null,
  eventType: string,
): string {
  const parts: string[] = [];
  if (eventType) parts.push(eventType);
  if (message) parts.push(message);
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (typeof value === "string") parts.push(value);
      else if (value && typeof value === "object") {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (typeof nested === "string") parts.push(nested);
        }
      }
    }
  }
  return parts.join(" ");
}

export function runVerificationService(db: Db) {
  return {
    /**
     * Collect verification evidence for an issue from its run log and its
     * registered work products. Both lookups are company-scoped.
     */
    async collectVerificationEvidence(
      companyId: string,
      issueId: string,
    ): Promise<VerificationEvidence> {
      // Run events are the only durable record of what the agent actually
      // executed, so the gate reads them rather than trusting agent claims.
      const workProductRows = await db
        .select({ title: issueWorkProducts.title })
        .from(issueWorkProducts)
        .where(
          and(
            eq(issueWorkProducts.companyId, companyId),
            eq(issueWorkProducts.issueId, issueId),
          ),
        )
        .limit(50);

      const deliverableTitles = workProductRows.map((row) => row.title);
      const hasDeliverableArtifact = deliverableTitles.length > 0;

      const runRows = await db
        .select({ id: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            eq(heartbeatRuns.status, "succeeded"),
          ),
        )
        .orderBy(desc(heartbeatRuns.finishedAt))
        .limit(50);

      const runIds = runRows.map((row) => row.id);
      if (runIds.length === 0) {
        return {
          hasRanVerificationCommand: false,
          hasDeliverableArtifact,
          verificationCommands: [],
          deliverableTitles,
          runIds: [],
        };
      }

      const eventRows = await db
        .select({
          eventType: heartbeatRunEvents.eventType,
          message: heartbeatRunEvents.message,
          payload: heartbeatRunEvents.payload,
        })
        .from(heartbeatRunEvents)
        .where(
          and(
            eq(heartbeatRunEvents.companyId, companyId),
            inArray(heartbeatRunEvents.runId, runIds),
          ),
        )
        .limit(2000);

      const verificationCommands: string[] = [];
      let sawFailureSignal = false;

      for (const event of eventRows) {
        const text = readEventText(event.payload, event.message, event.eventType);
        if (looksLikeVerificationCommand(text)) {
          verificationCommands.push(text.slice(0, 200));
        }
        if (
          event.eventType.toLowerCase().includes("error") ||
          /\b(failed|failure)\b/i.test(text)
        ) {
          sawFailureSignal = true;
        }
      }

      const hasRanVerificationCommand = verificationCommands.length > 0;
      // The wording must contain "failed"/"error" so that verifyRunRequirements
      // rejects it; those are the substrings the gate treats as a failure.
      const verificationOutput = hasRanVerificationCommand
        ? sawFailureSignal
          ? "Verification commands were executed but the run log reported errors (tests failed)."
          : `Executed ${verificationCommands.length} verification command(s).`
        : undefined;

      return {
        hasRanVerificationCommand,
        verificationOutput,
        hasDeliverableArtifact,
        verificationCommands,
        deliverableTitles,
        runIds,
      };
    },

    /**
     * Evaluate the plan's VERIFY gate. Enforced only for maximizer-mode
     * issues; every other work mode keeps its existing completion behavior.
     */
    async evaluateCompletionGate(
      companyId: string,
      issueId: string,
      policy: MaximizerPolicy = DEFAULT_MAXIMIZER_POLICY,
    ): Promise<VerificationGateResult> {
      const evidence = await this.collectVerificationEvidence(companyId, issueId);
      const result = verifyRunRequirements(
        {
          hasRanVerificationCommand: evidence.hasRanVerificationCommand,
          verificationOutput: evidence.verificationOutput,
          hasDeliverableArtifact: evidence.hasDeliverableArtifact,
        },
        policy,
      );
      return { ...result, evidence };
    },
  };
}
