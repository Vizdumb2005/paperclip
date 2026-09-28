import crypto from "node:crypto";
import type { StratumChunk } from "@paperclipai/shared";

export interface ParsedSection {
  breadcrumbs: string[];
  content: string;
  isTable: boolean;
}

/**
 * Layout-aware parser inspired by Stratum RAG.
 * Extracts section hierarchy breadcrumbs (# > ## > ###) and ensures
 * markdown tables are treated as atomic chunks to avoid destructive row splitting.
 */
export function parseMarkdownLayout(markdown: string): ParsedSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: ParsedSection[] = [];
  const breadcrumbStack: { level: number; text: string }[] = [];

  let currentBlock: string[] = [];
  let inTable = false;
  let tableBlock: string[] = [];

  const flushCurrentBlock = () => {
    if (currentBlock.length > 0) {
      const text = currentBlock.join("\n").trim();
      if (text) {
        sections.push({
          breadcrumbs: breadcrumbStack.map((b) => b.text),
          content: text,
          isTable: false,
        });
      }
      currentBlock = [];
    }
  };

  const flushTableBlock = () => {
    if (tableBlock.length > 0) {
      const text = tableBlock.join("\n").trim();
      if (text) {
        sections.push({
          breadcrumbs: breadcrumbStack.map((b) => b.text),
          content: text,
          isTable: true,
        });
      }
      tableBlock = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && !inTable) {
      flushCurrentBlock();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      // Pop deeper or equal levels
      while (breadcrumbStack.length > 0 && breadcrumbStack[breadcrumbStack.length - 1].level >= level) {
        breadcrumbStack.pop();
      }
      breadcrumbStack.push({ level, text: headingText });
      continue;
    }

    // Check table syntax (| col1 | col2 |)
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|");
    if (isTableRow) {
      if (!inTable) {
        flushCurrentBlock();
        inTable = true;
      }
      tableBlock.push(line);
      continue;
    }

    if (inTable && !isTableRow) {
      flushTableBlock();
    }

    currentBlock.push(line);
  }

  flushCurrentBlock();
  flushTableBlock();

  return sections;
}

/**
 * Token-bounded chunker with sliding overlap and breadcrumb prefixing.
 */
export function chunkSections(
  sections: ParsedSection[],
  options: { targetTokens?: number; overlapTokens?: number } = {},
): StratumChunk[] {
  const targetTokens = options.targetTokens ?? 450;
  const chunks: StratumChunk[] = [];

  for (const section of sections) {
    if (section.isTable) {
      // Tables are atomic chunks
      const id = "chk_" + crypto.createHash("sha256").update(section.content).digest("hex").slice(0, 16);
      const estTokens = Math.ceil(section.content.length / 4);
      chunks.push({
        chunkId: id,
        breadcrumbs: section.breadcrumbs,
        content: section.content,
        isTable: true,
        tokenCount: estTokens,
      });
      continue;
    }

    // Normal text chunking
    const words = section.content.split(/\s+/);
    if (words.length <= targetTokens) {
      const id = "chk_" + crypto.createHash("sha256").update(section.content).digest("hex").slice(0, 16);
      chunks.push({
        chunkId: id,
        breadcrumbs: section.breadcrumbs,
        content: section.content,
        isTable: false,
        tokenCount: words.length,
      });
      continue;
    }

    let start = 0;
    const step = Math.max(1, targetTokens - (options.overlapTokens ?? 50));
    while (start < words.length) {
      const chunkWords = words.slice(start, start + targetTokens);
      const chunkText = chunkWords.join(" ");
      const id = "chk_" + crypto.createHash("sha256").update(chunkText).digest("hex").slice(0, 16);
      chunks.push({
        chunkId: id,
        breadcrumbs: section.breadcrumbs,
        content: chunkText,
        isTable: false,
        tokenCount: chunkWords.length,
      });
      start += step;
    }
  }

  return chunks;
}

/**
 * Lightweight BM25 scoring for sparse keyword relevance.
 */
export function scoreBm25(query: string, documentText: string, avgDocLen = 200): number {
  const qTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
  const docTokens = documentText.toLowerCase().split(/\W+/).filter(Boolean);
  if (qTokens.length === 0 || docTokens.length === 0) return 0;

  const docLen = docTokens.length;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const token of qTokens) {
    const tf = docTokens.filter((t) => t === token).length;
    if (tf > 0) {
      const idf = Math.log(1 + 10 / (1 + 1)); // smooth idf
      const denom = tf + k1 * (1 - b + b * (docLen / avgDocLen));
      score += idf * ((tf * (k1 + 1)) / denom);
    }
  }

  return score;
}

/**
 * Exact Reciprocal Rank Fusion (RRF) matching Stratum RAG algorithm:
 * RRF(d) = sum_{m in M} 1 / (k + rank_m(d))
 * with default k = 60.
 */
export function reciprocalRankFusion<T extends { id: string }>(
  rankings: { model: string; rankedItems: T[] }[],
  k = 60,
): { item: T; rrfScore: number; ranks: Record<string, number> }[] {
  const scoreMap = new Map<string, { item: T; score: number; ranks: Record<string, number> }>();

  for (const { model, rankedItems } of rankings) {
    rankedItems.forEach((item, index) => {
      const rank = index + 1; // 1-based rank
      const rrfComponent = 1 / (k + rank);

      const existing = scoreMap.get(item.id) ?? {
        item,
        score: 0,
        ranks: {},
      };

      existing.score += rrfComponent;
      existing.ranks[model] = rank;
      scoreMap.set(item.id, existing);
    });
  }

  return Array.from(scoreMap.values())
    .map(({ item, score, ranks }) => ({
      item,
      rrfScore: score,
      ranks,
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
