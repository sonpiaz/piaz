-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Orgs
CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  telegram_chat_ids JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  telegram_user_id TEXT NOT NULL,
  user_name TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS users_org_tg_idx ON users(org_id, telegram_user_id);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  provider TEXT NOT NULL DEFAULT 'anthropic',
  bindings JSONB DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Sessions (metadata — actual transcripts on R2)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  r2_path TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_key_idx ON sessions(key);

-- Knowledge chunks (Company Brain)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_org_idx ON knowledge_chunks(org_id);

-- Full-text search index for BM25
CREATE INDEX IF NOT EXISTS knowledge_content_fts_idx ON knowledge_chunks
  USING gin(to_tsvector('english', content));
