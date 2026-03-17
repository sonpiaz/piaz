import type { LLMMessage } from "../providers/types.js";
import type { SessionKey } from "../types.js";
import type { SessionData } from "../context-engine.js";
import { formatSessionKey, log } from "../types.js";
import { readR2, writeR2 } from "./r2-writer.js";
import { getDb } from "../db/index.js";
import { findSession, upsertSession } from "../db/queries.js";

const MAX_CONTEXT_TOKENS = 180_000; // ~90% of 200k
const CHARS_PER_TOKEN = 4;

function r2Path(key: SessionKey): string {
  return `sessions/${key.orgId}/${key.agentId}/${key.channel}/${key.peerKind}/${key.peerId}.jsonl`;
}

export async function loadSession(key: SessionKey): Promise<SessionData> {
  const keyStr = formatSessionKey(key);

  // Check DB for metadata
  const db = getDb();
  const meta = await findSession(db, keyStr);

  const empty: SessionData = {
    key,
    messages: [],
    tokenEstimate: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (!meta) return empty;

  // Load JSONL from R2
  const raw = await readR2(meta.r2Path);
  if (!raw) return { ...empty, summary: meta.summary ?? undefined };

  try {
    const messages: LLMMessage[] = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    return {
      key,
      messages,
      summary: meta.summary ?? undefined,
      tokenEstimate: meta.tokenEstimate,
      createdAt: meta.createdAt.getTime(),
      updatedAt: meta.updatedAt.getTime(),
    };
  } catch (e) {
    log("error", "Failed to parse session JSONL", { key: keyStr, error: (e as Error).message });
    return empty;
  }
}

export async function saveSession(session: SessionData): Promise<void> {
  const keyStr = formatSessionKey(session.key);
  const path = r2Path(session.key);

  // Write JSONL to R2
  const jsonl = session.messages.map((m) => JSON.stringify(m)).join("\n");
  await writeR2(path, jsonl);

  // Update metadata in Postgres
  const db = getDb();
  await upsertSession(db, {
    key: keyStr,
    orgId: session.key.orgId,
    agentId: session.key.agentId,
    r2Path: path,
    tokenEstimate: session.tokenEstimate,
    summary: session.summary,
    messageCount: session.messages.length,
  });

  log("debug", "Session saved", { key: keyStr, messages: session.messages.length });
}

export function needsCompaction(session: SessionData): boolean {
  return session.tokenEstimate > MAX_CONTEXT_TOKENS;
}
