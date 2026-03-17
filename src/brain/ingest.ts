import { getDb } from "../db/index.js";
import { insertKnowledgeChunk } from "../db/queries.js";
import { log } from "../types.js";

const CHUNK_SIZE = 1000; // chars
const CHUNK_OVERLAP = 200;

export async function ingestDocument(
  orgId: string,
  source: string,
  content: string,
): Promise<number> {
  const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);
  const db = getDb();

  let inserted = 0;
  for (const chunk of chunks) {
    if (chunk.trim().length < 50) continue; // Skip tiny chunks
    await insertKnowledgeChunk(db, orgId, source, chunk);
    inserted++;
  }

  log("info", "Document ingested", { orgId, source, chunks: inserted });
  return inserted;
}

export function chunkText(
  text: string,
  size: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 100);
      const paraBreak = slice.lastIndexOf("\n\n");
      if (paraBreak > size * 0.6) {
        end = start + paraBreak + 2;
      } else {
        const sentBreak = slice.lastIndexOf(". ");
        if (sentBreak > size * 0.6) {
          end = start + sentBreak + 2;
        }
      }
    }

    chunks.push(text.slice(start, Math.min(end, text.length)));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

export function parseTextContent(raw: string, mimeType?: string): string {
  // For v0.1: plain text, markdown, and simple extraction
  // PDF/DOCX parsing deferred to Phase 1
  if (mimeType?.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}
