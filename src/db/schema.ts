import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  varchar,
  boolean,
  vector,
} from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  telegramChatIds: jsonb("telegram_chat_ids").$type<string[]>().default([]),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id)
      .notNull(),
    telegramUserId: text("telegram_user_id").notNull(),
    userName: text("user_name"),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("users_org_tg_idx").on(t.orgId, t.telegramUserId)],
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  name: text("name").notNull(),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  provider: text("provider").notNull().default("anthropic"),
  bindings: jsonb("bindings").$type<AgentBinding[]>().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface AgentBinding {
  type: "peer" | "chat" | "default";
  chatId?: string;
  userId?: string;
}

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    orgId: uuid("org_id")
      .references(() => orgs.id)
      .notNull(),
    agentId: uuid("agent_id")
      .references(() => agents.id)
      .notNull(),
    r2Path: text("r2_path").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    summary: text("summary"),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_key_idx").on(t.key)],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => orgs.id)
      .notNull(),
    source: text("source").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("knowledge_org_idx").on(t.orgId)],
);
