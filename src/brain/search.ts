import { getDb } from "../db/index.js";
import { searchKnowledgeBM25, searchKnowledgeVector } from "../db/queries.js";
import { log } from "../types.js";

const VECTOR_TIMEOUT = 5000; // 5s timeout, fallback to BM25 only

export interface SearchResult {
  content: string;
  source: string;
  score?: number;
}

export async function searchKnowledge(
  orgId: string,
  query: string,
  opts?: { limit?: number; embedding?: number[] },
): Promise<SearchResult[]> {
  const limit = opts?.limit ?? 5;
  const db = getDb();

  // BM25 search (always runs)
  const bm25Results = await searchKnowledgeBM25(db, orgId, query, limit);

  // Vector search with timeout (only if embedding provided)
  let vectorResults: typeof bm25Results = [];
  if (opts?.embedding) {
    try {
      vectorResults = await Promise.race([
        searchKnowledgeVector(db, orgId, opts.embedding, limit),
        timeout(VECTOR_TIMEOUT),
      ]);
    } catch (e) {
      log("warn", "Vector search timed out or failed, using BM25 only", {
        orgId,
        error: (e as Error).message,
      });
    }
  }

  // Merge and deduplicate (MMR-inspired: prefer diverse sources)
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Interleave BM25 and vector results
  const maxLen = Math.max(bm25Results.length, vectorResults.length);
  for (let i = 0; i < maxLen && merged.length < limit; i++) {
    if (i < bm25Results.length) {
      const r = bm25Results[i];
      const key = r.content.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ content: r.content, source: r.source });
      }
    }
    if (i < vectorResults.length) {
      const r = vectorResults[i];
      const key = r.content.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ content: r.content, source: r.source });
      }
    }
  }

  return merged.slice(0, limit);
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
}
