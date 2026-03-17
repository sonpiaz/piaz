import { eq, and, sql } from "drizzle-orm";
import type { Db } from "./index.js";
import { orgs, users, agents, sessions, knowledgeChunks } from "./schema.js";

// --- Orgs ---

export async function findOrgByTelegramChat(db: Db, chatId: string) {
  const rows = await db
    .select()
    .from(orgs)
    .where(sql`${orgs.telegramChatIds} @> ${JSON.stringify([chatId])}::jsonb`);
  return rows[0] ?? null;
}

export async function createOrg(db: Db, name: string, chatIds: string[] = []) {
  const [row] = await db
    .insert(orgs)
    .values({ name, telegramChatIds: chatIds })
    .returning();
  return row;
}

// --- Users ---

export async function findOrCreateUser(
  db: Db,
  orgId: string,
  telegramUserId: string,
  userName?: string,
) {
  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.telegramUserId, telegramUserId)));
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(users)
    .values({ orgId, telegramUserId, userName })
    .returning();
  return row;
}

// --- Agents ---

export async function findAgentForChat(db: Db, orgId: string, chatId: string) {
  const allAgents = await db
    .select()
    .from(agents)
    .where(and(eq(agents.orgId, orgId), eq(agents.active, true)));

  // 3-tier resolution: peer binding > chat binding > default
  for (const agent of allAgents) {
    for (const b of agent.bindings ?? []) {
      if (b.type === "peer" && b.chatId === chatId) return agent;
    }
  }
  for (const agent of allAgents) {
    for (const b of agent.bindings ?? []) {
      if (b.type === "chat" && b.chatId === chatId) return agent;
    }
  }
  for (const agent of allAgents) {
    for (const b of agent.bindings ?? []) {
      if (b.type === "default") return agent;
    }
  }
  return allAgents[0] ?? null;
}

export async function createAgent(
  db: Db,
  orgId: string,
  name: string,
  opts?: { model?: string; provider?: string },
) {
  const [row] = await db
    .insert(agents)
    .values({
      orgId,
      name,
      model: opts?.model ?? "claude-sonnet-4-6",
      provider: opts?.provider ?? "anthropic",
      bindings: [{ type: "default" }],
    })
    .returning();
  return row;
}

// --- Sessions ---

export async function findSession(db: Db, key: string) {
  const rows = await db.select().from(sessions).where(eq(sessions.key, key));
  return rows[0] ?? null;
}

export async function upsertSession(
  db: Db,
  data: {
    key: string;
    orgId: string;
    agentId: string;
    r2Path: string;
    tokenEstimate: number;
    summary?: string;
    messageCount: number;
  },
) {
  const [row] = await db
    .insert(sessions)
    .values(data)
    .onConflictDoUpdate({
      target: sessions.key,
      set: {
        r2Path: data.r2Path,
        tokenEstimate: data.tokenEstimate,
        summary: data.summary,
        messageCount: data.messageCount,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

// --- Knowledge ---

export async function insertKnowledgeChunk(
  db: Db,
  orgId: string,
  source: string,
  content: string,
  embedding?: number[],
  metadata?: Record<string, unknown>,
) {
  const [row] = await db
    .insert(knowledgeChunks)
    .values({ orgId, source, content, embedding, metadata })
    .returning();
  return row;
}

export async function searchKnowledgeBM25(db: Db, orgId: string, query: string, limit = 5) {
  const rows = await db
    .select()
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.orgId, orgId),
        sql`to_tsvector('english', ${knowledgeChunks.content}) @@ plainto_tsquery('english', ${query})`,
      ),
    )
    .orderBy(
      sql`ts_rank(to_tsvector('english', ${knowledgeChunks.content}), plainto_tsquery('english', ${query})) DESC`,
    )
    .limit(limit);
  return rows;
}

export async function searchKnowledgeVector(
  db: Db,
  orgId: string,
  embedding: number[],
  limit = 5,
) {
  const rows = await db
    .select()
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.orgId, orgId),
        sql`${knowledgeChunks.embedding} IS NOT NULL`,
      ),
    )
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${JSON.stringify(embedding)}::vector`)
    .limit(limit);
  return rows;
}
