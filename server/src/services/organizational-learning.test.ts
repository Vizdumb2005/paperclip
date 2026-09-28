import { describe, expect, it, vi } from "vitest";
import { organizationalLearningService } from "./organizational-learning.js";

vi.mock("./company-memory.js", () => ({
  companyMemoryService: () => ({
    ingestDocument: vi.fn().mockResolvedValue([]),
  }),
}));

describe("organizationalLearningService", () => {
  it("distills completed issues into markdown playbooks and ingests into memory", async () => {
    const mockDb: any = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "doc-123" }]),
        }),
      }),
    };

    const service = organizationalLearningService(mockDb);
    const result = await service.distillCompletedIssue({
      companyId: "comp-1",
      issueId: "issue-999",
      issueTitle: "Fix Database Migration Snapshot Collation",
      issueDescription: "Snapshots failed due to collation mismatch in PGlite",
      runSummary: "Replaced unix-specific shell pipes with cross-platform node script.",
      toolInvocations: [
        { tool: "run_command", command: "node scripts/prune-snapshots.mjs" },
      ],
      verificationResults: [
        "Vitest 16/16 tests passing",
        "Migration generated cleanly",
      ],
    });

    expect(result.slug).toBe("playbook-fix-database-migration-snapshot-collation");
    expect(result.title).toBe("Playbook: Fix Database Migration Snapshot Collation");
    expect(result.tier).toBe("consolidated");
    expect(result.content).toContain("# Playbook: Fix Database Migration Snapshot Collation");
    expect(result.content).toContain("## Problem Context");
    expect(result.content).toContain("Replaced unix-specific shell pipes");
    expect(result.content).toContain("Vitest 16/16 tests passing");
    expect(result.documentId).toBe("doc-123");
  });
});
