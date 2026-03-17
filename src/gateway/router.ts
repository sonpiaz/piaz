import { createHash } from "node:crypto";
import type { IncomingMessage, SessionKey, OrgContext } from "../types.js";
import { log } from "../types.js";
import { getDb } from "../db/index.js";
import { findOrgByTelegramChat, findAgentForChat, findOrCreateUser } from "../db/queries.js";

// --- Dedup ---
const DEDUP_TTL = 60_000;
const DEDUP_CAP = 1000;
const dedupMap = new Map<string, number>();

function dedupHash(msg: IncomingMessage): string {
  return createHash("sha256")
    .update(`${msg.chatId}:${msg.userId}:${msg.text}:${msg.timestamp}`)
    .digest("hex")
    .slice(0, 16);
}

function isDuplicate(msg: IncomingMessage): boolean {
  const hash = dedupHash(msg);
  const now = Date.now();

  // Evict stale entries
  if (dedupMap.size > DEDUP_CAP) {
    for (const [k, ts] of dedupMap) {
      if (now - ts > DEDUP_TTL) dedupMap.delete(k);
    }
  }

  if (dedupMap.has(hash)) return true;
  dedupMap.set(hash, now);
  return false;
}

// --- Rate limit ---
const RATE_LIMIT = 20; // per minute
const RATE_WINDOW = 60_000;
const rateMap = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  let timestamps = rateMap.get(userId) ?? [];
  timestamps = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  rateMap.set(userId, timestamps);
  return false;
}

// --- Route ---
export interface RouteResult {
  sessionKey: SessionKey;
  orgContext: OrgContext;
}

export async function route(msg: IncomingMessage): Promise<RouteResult | null> {
  // Dedup
  if (isDuplicate(msg)) {
    log("debug", "Duplicate message dropped", { chatId: msg.chatId, userId: msg.userId });
    return null;
  }

  // Rate limit
  if (isRateLimited(msg.userId)) {
    log("warn", "Rate limited", { userId: msg.userId });
    return null;
  }

  // Org resolution
  const db = getDb();
  const org = await findOrgByTelegramChat(db, msg.chatId);
  if (!org) {
    log("debug", "No org for chat", { chatId: msg.chatId });
    return null;
  }

  // User tracking
  await findOrCreateUser(db, org.id, msg.userId, msg.userName);

  // Agent resolution (3-tier)
  const agent = await findAgentForChat(db, org.id, msg.chatId);
  if (!agent) {
    log("warn", "No agent for org/chat", { orgId: org.id, chatId: msg.chatId });
    return null;
  }

  // Determine peer kind
  const peerKind: "group" | "dm" =
    msg.chatId.startsWith("-") ? "group" : "dm";

  const sessionKey: SessionKey = {
    agentId: agent.id,
    orgId: org.id,
    channel: "telegram",
    peerKind,
    peerId: msg.chatId,
  };

  const orgContext: OrgContext = {
    orgId: org.id,
    orgName: org.name,
    agentId: agent.id,
    agentName: agent.name,
    systemPromptFiles: {},
  };

  return { sessionKey, orgContext };
}
