# Piaz v0.1 — Engineering Plan

*Informed by deep analysis of OpenClaw source code + Viktor product architecture*

---

## Design Philosophy

Piaz borrows the best architectural patterns from OpenClaw (proven at 318K stars) while solving what it can't: **multi-tenant cloud SaaS for teams on Telegram**.

From Viktor, Piaz learns the UX: **join in 30 seconds, answer questions immediately, grow smarter over time**. But Piaz differentiates with **multi-agent marketplace + transparent per-agent pricing + open core**.

### Principles (from OpenClaw's "Shitty Coding Agent" philosophy)

1. **Minimal > Complex** — simple while loop, not complex state machine
2. **Files > Databases** — JSONL for sessions, Markdown for memory, DB only for multi-tenant
3. **Single Process > Microservices** — one Node.js process, fewer failure modes
4. **Copy-Paste > Abstraction** — duplicate if clearer, no premature shared packages
5. **Gateway owns everything** — no agent talks to Telegram directly

---

## Architecture (Informed by OpenClaw)

```
┌──────────────────────────────────────────────────────────────┐
│                        PIAZ GATEWAY                           │
│                  (Single Node.js process)                     │
│                                                               │
│  ┌─────────────┐                                             │
│  │  Telegram    │  grammy, long-polling                      │
│  │  Adapter     │  normalize → IncomingMessage               │
│  └──────┬──────┘                                             │
│         │                                                     │
│  ┌──────▼──────┐                                             │
│  │   Router     │  7-tier matching (from OpenClaw)            │
│  │              │  dedup 60s TTL, rate-limit 20/min           │
│  │              │  session key: agent:{id}:tg:{chatId}       │
│  └──────┬──────┘                                             │
│         │                                                     │
│  ┌──────▼──────┐  ┌──────────────┐                           │
│  │   Session    │  │  Worker Pool │                           │
│  │   Manager    │──│  (threads)   │                           │
│  │  JSONL files │  │              │                           │
│  │  + compaction│  │  Claude API  │                           │
│  └─────────────┘  │  tool loop   │                           │
│                    │  max 50 iter │                           │
│                    └──────┬───────┘                           │
│                           │                                   │
│  ┌────────────────────────▼──────────────────────────┐       │
│  │              Tool Registry                         │       │
│  │  Built-in: Read, Write, WebFetch, MemorySearch    │       │
│  │  Skills: SKILL.md (6-source precedence)           │       │
│  │  Lazy loading: summaries in prompt, full on demand │       │
│  └───────────────────────────────────────────────────┘       │
│                           │                                   │
│  ┌────────────────────────▼──────────────────────────┐       │
│  │              Company Brain (per-org)               │       │
│  │  workspace/SOUL.md + AGENTS.md + MEMORY.md        │       │
│  │  workspace/memory/*.md (daily notes)              │       │
│  │  workspace/knowledge/* (uploaded docs)            │       │
│  └───────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions (Stolen from OpenClaw)

| Decision | OpenClaw Pattern | Piaz Adaptation |
|----------|-----------------|-----------------|
| Session key | `agent:{id}:{channel}:{peer}` | Same — filesystem-safe, no DB needed |
| Routing | 7-tier binding match | Simplified to 3-tier for v0.1 (peer > chat > default) |
| Sessions | JSONL files, compaction at 90% | Same — proven, simple, grep-able |
| Skills | 6-source precedence, SKILL.md | Same format, 3 sources for v0.1 (workspace > bundled > plugin) |
| Memory | Hybrid BM25 + vector (SQLite) | Start with BM25-only (no embedding dependency), add vector later |
| Tool loading | Lazy (summaries + full on demand) | Same — stolen from Viktor's 68-summary pattern |
| Context engine | Pluggable `ingest/assemble/compact` | Same interface, single impl for v0.1 |
| A2A policy | `self/tree/agent/all` visibility | Same — essential for multi-agent marketplace |
| Auth rotation | Scale iterations by profile count | Defer — single API key for v0.1 |

### Key Differences from OpenClaw

| OpenClaw | Piaz | Why |
|----------|------|-----|
| Local-first `ws://127.0.0.1` | Cloud service (Railway) | Multi-tenant SaaS |
| Plugin SDK (158 files) | Minimal adapter interface | Ship fast |
| SQLite per-agent | PostgreSQL for org data (sessions stay JSONL) | Multi-tenant needs shared DB |
| Self-host only | Cloud + open core | Dual distribution |

---

## Phase 0 — Working Bot (Week 1-2)

### Goal
One Telegram bot that joins a group, learns context from uploaded files, answers company questions.

### File List (~14 files)

```
piaz/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
│
├── src/
│   ├── main.ts                 ← Entry: Telegram + Gateway wiring
│   │
│   ├── channels/
│   │   ├── types.ts            ← ChannelAdapter interface + IncomingMessage
│   │   └── telegram.ts         ← grammy adapter (NEW)
│   │
│   ├── gateway/
│   │   ├── index.ts            ← Orchestrator: session lock, queue, echo guard
│   │   ├── router.ts           ← Dedup (60s TTL), rate-limit, session resolve
│   │   ├── session-mgr.ts      ← JSONL sessions + 2-tier compaction
│   │   └── worker-spawner.ts   ← Worker thread lifecycle
│   │
│   ├── worker.ts               ← System prompt builder + Claude API tool loop
│   ├── tool-registry.ts        ← Tool dispatch (built-in + skills)
│   └── context-engine.ts       ← Pluggable: ingest/assemble/compact
│
├── workspace/
│   ├── SOUL.md                 ← Piaz Core identity
│   ├── AGENTS.md               ← Behavior rules
│   └── skills/
│       └── company-brain/
│           └── SKILL.md        ← Q&A skill
│
└── tests/
    ├── telegram-adapter.test.ts
    ├── router.test.ts
    └── session-mgr.test.ts
```

### Data Flow

```
Telegram message
    │
    ▼
telegram.ts: bot.on("message")
  → { channel: "telegram", chatId, userId, text, images? }
    │
    ▼
router.ts: dedup check (Map<hash, timestamp>, 60s TTL, 1000 cap)
  → rate-limit check (Map<userId, count[]>, 20/min)
  → session key = "agent:piaz-core:tg:group:{chatId}"
    │
    ▼
gateway/index.ts: acquire session lock (Map<sessionKey, Promise>)
  → spawn worker thread
    │
    ▼
worker.ts:
  1. loadSystemPrompt()
     ├── Read SOUL.md (mtime-cached)
     ├── Read AGENTS.md (mtime-cached)
     ├── Read MEMORY.md (mtime-cached)
     ├── Inject runtime info (date, model, channel)
     └── Inject skill summaries (lazy)
  2. loadSession() → read JSONL, check compaction threshold
  3. Claude API call (Sonnet 4.6 default)
  4. Tool loop (max 50 iterations)
     ├── Tool call? → dispatch via tool-registry
     ├── Tool result → append to messages → back to Claude
     └── No tool call? → final response
  5. Persist session (append to JSONL)
    │
    ▼
telegram.ts: bot.api.sendMessage(chatId, response, { parse_mode: "HTML" })
```

### Session Key Design (from OpenClaw)

```
Format: agent:{agentId}:tg:{peerKind}:{peerId}

Examples:
  agent:piaz-core:tg:group:498509454        # Group chat
  agent:piaz-core:tg:dm:123456789           # Direct message
  agent:report-agent:tg:group:498509454     # Different agent, same group
```

### System Prompt Construction (from Hidrix pattern)

```
<soul>
{workspace/SOUL.md}                          # Identity, personality
</soul>

<agents>
{workspace/AGENTS.md}                        # Behavior rules, tool rules
</agents>

<memory>
{workspace/MEMORY.md}                        # Company knowledge
</memory>

<runtime>
- Date: 2026-03-17T10:00:00Z
- Model: claude-sonnet-4-6
- Channel: telegram
- Chat: {chatId}
- User: {userId}
</runtime>

<available_skills>
- company-brain: Answer questions about the company | path: skills/company-brain/SKILL.md
</available_skills>
```

### SOUL.md for Piaz Core

```markdown
# Piaz Core — Company Brain

## Identity
You are Piaz, an AI team member that lives in this Telegram group.
You know everything about this company — SOPs, products, team, decisions.

## Rules
1. Answer from Company Brain first. If not found, say so honestly.
2. Never fabricate company-specific information.
3. Keep answers concise. Link to source docs when available.
4. Speak the language the user speaks (Vietnamese or English).
5. You're a team member, not a chatbot. Be direct, helpful, no fluff.

## What You Do
- Answer any question about the company
- Explain SOPs and processes
- Help new team members onboard
- Track decisions and context

## What You Don't Do (Yet)
- Execute external actions (coming soon with specialized agents)
- Access external tools (coming soon)
- Send emails or create tickets (coming soon)
```

---

## Phase 1 — Multi-Tenant + Knowledge (Week 3-4)

### New Components
- `src/db/schema.ts` — PostgreSQL (Neon): orgs, users, agents
- `src/db/queries.ts` — Typed queries via Drizzle ORM
- `src/brain/ingest.ts` — File upload → parse → index into memory
- `src/brain/search.ts` — BM25 search over company knowledge

### Org Model

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   orgs   │     │  agents  │     │  users   │
├──────────┤     ├──────────┤     ├──────────┤
│ id       │──┐  │ id       │     │ id       │
│ name     │  │  │ org_id FK│     │ org_id FK│
│ tg_chat  │  │  │ template │     │ tg_user  │
│ brain_dir│  │  │ name     │     │ role     │
│ plan     │  │  │ soul_md  │     │ created  │
│ created  │  │  │ status   │     └──────────┘
└──────────┘  │  │ hired_at │
              │  │ config   │
              │  └──────────┘
              │
              └── workspace/{orgId}/
                  ├── SOUL.md
                  ├── AGENTS.md
                  ├── MEMORY.md
                  ├── memory/*.md
                  └── knowledge/*
```

### Onboarding Flow (from Product Vision)

```
1. User → /start in Telegram DM with @PiazBot
   └── "Welcome! Send me your company name."

2. User → "Affitor"
   └── Piaz creates org, generates invite link
   └── "Done! Add me to your team group: t.me/PiazBot?startgroup=abc123"

3. User adds bot to Telegram group
   └── Piaz: "Hi team! I'm Piaz, your new AI team member.
              Upload any docs (SOPs, product info, team structure)
              and I'll learn them. Or just start asking questions!"

4. Someone uploads a PDF/doc
   └── brain/ingest.ts: parse → chunk → index → memory/
   └── Piaz: "Got it! I've learned about [topic]. Ask me anything."

5. Any team member asks a question
   └── brain/search.ts: BM25 search → context injection → Claude → answer
```

---

## Phase 2 — Agent Marketplace (Week 5-6)

### Hire/Fire Pattern (from Product Vision "thuê tướng")

```
User: /hire report-agent
  └── Piaz: "Hiring Report Agent... 📊
             This agent will:
             - Generate daily/weekly reports
             - Track KPIs across tools
             - Deliver summaries to this chat

             Cost: $X/month. Confirm? [Yes] [No]"

User: [Yes]
  └── Gateway creates new agent session
  └── New SOUL.md from template
  └── Agent binding: agent:report-agent:tg:group:{chatId}
  └── Cron job: daily report at 9 AM
  └── Report Agent: "I'm here! I'll send your first report tomorrow at 9 AM.
                      Want me to pull data from any specific tools?"
```

### Agent Isolation (A2A policy from OpenClaw)

```yaml
# Each hired agent gets:
agents:
  - id: "report-agent-{orgId}"
    workspace: "workspaces/{orgId}/agents/report-agent/"
    visibility: "tree"           # Can only see own sessions
    agentToAgent:
      enabled: true
      allow: ["piaz-core-{orgId}"]  # Can talk to Piaz Core only
    tools:
      - Read, Write, WebFetch     # Limited tool set
      - report-*                  # Domain-specific tools only
```

---

## NOT in Scope (v0.1)

| Item | Rationale |
|------|-----------|
| Multi-agent marketplace | Phase 2 — prove single agent value first |
| Per-agent billing / Stripe | Free beta, add billing when 10+ orgs |
| piaz.ai landing page | Telegram-only onboarding for v0.1 |
| Notion/Drive auto-crawl | Manual file upload first |
| Agent SDK | Internal agents only |
| Vector search (embeddings) | BM25 sufficient for v0.1, add pgvector later |
| Cron system | Not needed for Q&A bot |
| Sub-agent spawning | Single agent handles everything in v0.1 |
| Discord/Slack/WhatsApp | Telegram-only |
| SharedBrain cross-session | Single agent per org |
| Code execution sandbox | Unlike Viktor, defer to Phase 2 |
| Auth profile rotation | Single API key for v0.1 |

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Match OpenClaw/Hidrix, strong typing for tool schemas |
| Runtime | Node.js >= 22 | Match OpenClaw |
| Telegram | grammy | Modern, TS-first, middleware pattern |
| LLM | Claude Sonnet 4.6 (default) | Best cost/quality for team Q&A |
| Sessions | JSONL files | Proven by OpenClaw at scale |
| Memory search | BM25 (full-text) | No embedding dependency, upgrade to vector later |
| Database | PostgreSQL (Neon) | Multi-tenant org data only |
| Deploy | Railway | Son already uses, simple |
| Package manager | pnpm | Match OpenClaw |
| Testing | Vitest | Match OpenClaw |

---

## Failure Modes

| Failure | Severity | Prevention |
|---------|----------|------------|
| Bot token leaked | Critical | Env vars only, .env in .gitignore, Railway secrets |
| Context overflow (200K) | High | 2-tier compaction (from OpenClaw), 90% threshold |
| Rate limit from Claude API | Medium | Exponential backoff, queue overflow to message |
| Telegram API rate limit | Medium | grammy auto-retry, message queue |
| JSONL corruption (crash mid-write) | Medium | Append-only, validate on read, skip malformed |
| Hallucination about company | High | Always search Company Brain first, cite sources |
| Concurrent writes to same session | Medium | Session lock (Map<key, Promise>) from Hidrix |

---

## Success Criteria (Phase 0)

- [ ] Bot joins Telegram group in < 30 seconds
- [ ] Answers company questions from uploaded docs
- [ ] Maintains conversation context across messages
- [ ] Session compaction works (no context overflow)
- [ ] Deployed on Railway, accessible 24/7
- [ ] < 10s response time for simple Q&A

---

*Plan v0.1 — 2026-03-17*
*Informed by: OpenClaw source code (318K stars), Viktor product analysis, Hidrix architecture (14K lines)*
