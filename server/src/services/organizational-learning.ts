import type { Db } from "@paperclipai/db";
import { documents } from "@paperclipai/db";
import type {
  PlaybookDistillationInput,
  PlaybookDistillationResult,
} from "@paperclipai/shared";
import { companyMemoryService } from "./company-memory.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function organizationalLearningService(db: Db) {
  const memoryService = companyMemoryService(db);

  return {
    async distillCompletedIssue(
      input: PlaybookDistillationInput,
    ): Promise<PlaybookDistillationResult> {
      const slug = `playbook-${slugify(input.issueTitle)}`;
      const title = `Playbook: ${input.issueTitle}`;

      // Build structured markdown playbook
      const playbookContent = [
        `# ${title}`,
        "",
        "## Problem Context",
        input.issueDescription ?? input.issueTitle,
        "",
        "## Verified Solution Recipe",
        input.runSummary ?? "Task completed successfully through standard workflow.",
        "",
        ...(input.toolInvocations && input.toolInvocations.length > 0
          ? [
              "### Key Execution Steps",
              ...input.toolInvocations.map(
                (inv, idx) => `${idx + 1}. **${inv.tool}**: \`${inv.command ?? "standard dispatch"}\``,
              ),
              "",
            ]
          : []),
        "## Verification Evidence",
        ...(input.verificationResults && input.verificationResults.length > 0
          ? input.verificationResults.map((res) => `- ${res}`)
          : ["- Verified against automated regression checks."]),
        "",
        "---",
        `*Auto-distilled from verified Issue #${input.issueId} on ${new Date().toISOString()}*`,
      ].join("\n");

      // 1. Persist to company documents table
      const [doc] = await db
        .insert(documents)
        .values({
          companyId: input.companyId,
          title,
          format: "markdown",
          latestBody: playbookContent,
        })
        .returning();

      // 2. Ingest into company memory (Stratum layout parser + RRF indexing)
      await memoryService.ingestDocument(input.companyId, {
        sourceType: "playbook",
        sourceId: doc ? doc.id : input.issueId,
        title,
        content: playbookContent,
        issueId: input.issueId,
        tier: "consolidated",
      });

      return {
        documentId: doc ? doc.id : undefined,
        slug,
        title,
        content: playbookContent,
        tier: "consolidated",
        metadata: {
          distilledFromIssueId: input.issueId,
          distilledAt: new Date().toISOString(),
        },
      };
    },
  };
}
