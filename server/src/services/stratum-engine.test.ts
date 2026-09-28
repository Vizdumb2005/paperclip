import { describe, expect, it } from "vitest";
import {
  chunkSections,
  parseMarkdownLayout,
  reciprocalRankFusion,
  scoreBm25,
} from "./stratum-engine.js";

describe("Stratum Engine", () => {
  it("parses document layout and preserves table as atomic chunk", () => {
    const markdown = `# Architecture Overview
Here is the system intro.

## Database Schema
The database uses PostgreSQL.

| Table | Columns | Purpose |
| --- | --- | --- |
| users | id, email | User profiles |
| issues | id, title | Task tracking |

### Next Steps
Deploy to production.`;

    const sections = parseMarkdownLayout(markdown);
    expect(sections).toHaveLength(4);

    // Section 1: Intro
    expect(sections[0].breadcrumbs).toEqual(["Architecture Overview"]);
    expect(sections[0].content).toContain("Here is the system intro.");
    expect(sections[0].isTable).toBe(false);

    // Section 2: Database text
    expect(sections[1].breadcrumbs).toEqual(["Architecture Overview", "Database Schema"]);
    expect(sections[1].content).toContain("The database uses PostgreSQL.");
    expect(sections[1].isTable).toBe(false);

    // Section 3: Atomic Table
    expect(sections[2].breadcrumbs).toEqual(["Architecture Overview", "Database Schema"]);
    expect(sections[2].isTable).toBe(true);
    expect(sections[2].content).toContain("| users | id, email | User profiles |");

    // Section 4: Next Steps
    expect(sections[3].breadcrumbs).toEqual(["Architecture Overview", "Database Schema", "Next Steps"]);
    expect(sections[3].isTable).toBe(false);
  });

  it("chunks sections without splitting atomic tables", () => {
    const sections = parseMarkdownLayout(`## Metrics Table
| Metric | Value |
| A | 1 |
| B | 2 |`);

    const chunks = chunkSections(sections, { targetTokens: 10 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].isTable).toBe(true);
    expect(chunks[0].chunkId).toMatch(/^chk_[0-9a-f]{16}$/);
    expect(chunks[0].breadcrumbs).toEqual(["Metrics Table"]);
  });

  it("computes BM25 score for matching query tokens", () => {
    const doc = "PostgreSQL database migrations with Drizzle ORM";
    const scoreMatch = scoreBm25("PostgreSQL Drizzle", doc);
    const scoreNoMatch = scoreBm25("Kubernetes Docker", doc);

    expect(scoreMatch).toBeGreaterThan(0);
    expect(scoreNoMatch).toBe(0);
  });

  it("computes mathematically exact Reciprocal Rank Fusion", () => {
    const itemA = { id: "doc-A", title: "Doc A" };
    const itemB = { id: "doc-B", title: "Doc B" };
    const itemC = { id: "doc-C", title: "Doc C" };

    // Dense: [A, B, C]
    // Sparse: [B, A, C]
    const fused = reciprocalRankFusion(
      [
        { model: "dense", rankedItems: [itemA, itemB, itemC] },
        { model: "sparse", rankedItems: [itemB, itemA, itemC] },
      ],
      60,
    );

    expect(fused).toHaveLength(3);
    // Both A and B are rank 1 and 2 in the two models:
    // RRF(A) = 1/(60+1) + 1/(60+2) = 1/61 + 1/62
    // RRF(B) = 1/(60+2) + 1/(60+1) = 1/62 + 1/61
    // RRF(C) = 1/(60+3) + 1/(60+3) = 2/63
    const scoreExpectedA = 1 / 61 + 1 / 62;
    expect(fused[0].rrfScore).toBeCloseTo(scoreExpectedA, 5);
    expect(fused[1].rrfScore).toBeCloseTo(scoreExpectedA, 5);
    expect(fused[2].item.id).toBe("doc-C");
    expect(fused[2].rrfScore).toBeCloseTo(2 / 63, 5);
  });
});
