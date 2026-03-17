# OpenClaw — Deep Technical Architecture (Source Code Analysis)

*Phân tích từ source code thực tế, không phải marketing*

---

## Codebase Scale

- **Stars:** 318k | **Forks:** 61.1k | **19,811 commits**
- **Language:** TypeScript (Node >=22)
- **Source root:** `src/` — 47+ directories, 700+ files in agents alone
- **License:** MIT

---

## 1. Source Code Structure

```
src/
├── entry.ts                    # CLI entry (fast-path --version/--help)
├── gateway/                    # WebSocket control plane (~250 files)
│   ├── server.ts               # startGatewayServer()
│   ├── server/                 # Core impl (server.impl.ts)
│   ├── protocol/               # JSON-WS frames, AJV validators
│   ├── server-methods/         # 67 files — one handler per RPC method
│   │   ├── chat.ts             # chat.send → dispatchInboundMessage()
│   │   ├── agent.ts            # agent → dispatchAgentRunFromGateway()
│   │   ├── sessions.ts         # sessions.list/get/reset/patch/compact
│   │   └── cron.ts, skills.ts, browser.ts, nodes.ts, ...
│   └── call.ts                 # callGateway() — WS client for RPC
├── agents/                     # Agent runtime (~583 files)
│   ├── agent-scope.ts          # Multi-agent config resolution
│   ├── pi-embedded-runner/     # Core run loop
│   │   ├── run.ts              # runEmbeddedPiAgent() — main agentic loop
│   │   └── compact.ts          # compactEmbeddedPiSession()
│   ├── skills/                 # Skill loading (19 files)
│   │   ├── workspace.ts        # loadSkillEntries() — 6-source precedence
│   │   └── frontmatter.ts      # parseFrontmatter()
│   ├── tools/                  # 95 files — every tool implementation
│   │   ├── agent-step.ts       # runAgentStep() — inter-agent RPC
│   │   ├── sessions-access.ts  # AgentToAgentPolicy, visibility guard
│   │   ├── subagents-tool.ts   # list/kill/steer subagents
│   │   └── memory-tool.ts, cron-tool.ts, browser-tool.ts, ...
│   └── sandbox/                # Docker/SSH sandboxes (62 files)
├── routing/                    # Message → agent routing (11 files)
│   ├── resolve-route.ts        # resolveAgentRoute() — 7-tier matching
│   ├── bindings.ts             # buildChannelAccountBindings()
│   └── session-key.ts          # Key: agent:{agentId}:{channel}:{peer}
├── sessions/                   # Session metadata (13 files)
├── cron/                       # Cron scheduler (75 files)
│   ├── service.ts              # CronService: add/update/remove/run
│   └── isolated-agent/         # Cron runs as isolated sessions
├── memory/                     # Vector memory (103 files)
│   ├── manager.ts              # SQLite + vector search
│   ├── hybrid.ts               # BM25 + vector hybrid search
│   ├── mmr.ts                  # Maximal Marginal Relevance reranking
│   └── temporal-decay.ts       # Recency bias
├── context-engine/             # Pluggable context assembly/compaction
│   ├── types.ts                # ContextEngine interface
│   └── registry.ts             # registerContextEngine()
├── providers/                  # LLM provider adapters
├── plugin-sdk/                 # Public SDK for plugins (158 files)
├── plugins/                    # Plugin registry + lifecycle (137 files)
└── channels/                   # Channel type system
```

---

## 2. Gateway — WebSocket Control Plane

**What:** Single long-lived Node.js daemon on `ws://127.0.0.1:18789`. All clients (CLI, macOS app, WebChat, iOS/Android, agents) connect via WebSocket.

**Protocol:** JSON frames with 3 types:
- `RequestFrame {id, method, params}` — client sends
- `ResponseFrame {id, result | error}` — server replies
- `EventFrame` — bidirectional streaming (text chunks, tool results)

**~100+ RPC methods** covering: agents, chat, sessions, cron, config, browser, nodes, skills, tools-catalog, secrets, exec-approval, health, TTS, voice-wake, wizard.

**Authentication:**
- Local loopback → auto-approved
- Same tailnet → auto-approved
- Remote → requires `OPENCLAW_GATEWAY_TOKEN`
- Device pairing for nodes

**Key insight:** The gateway owns EVERYTHING — sessions, routing, channels, cron, tools. No agent talks to a channel directly. This clean separation means: swap a channel adapter without touching agent code.

---

## 3. Routing Engine — 7-Tier Matching

`resolveAgentRoute()` in `routing/resolve-route.ts`:

**Match tiers (first match wins):**
1. `binding.peer` — exact peer ID (specific DM sender or group)
2. `binding.peer.parent` — thread parent (inheritance)
3. `binding.guild+roles` — Discord guild + member roles
4. `binding.team` — Slack team/workspace
5. `binding.account` — specific account pattern
6. `binding.channel` — channel-wide wildcard (`accountId: "*"`)
7. `default` — falls back to default agent

**Caching:** WeakMap LRU (2000 binding index keys, 4000 route keys). Invalidated when `cfg.bindings`, `cfg.agents`, or `cfg.session` change.

**Session key format:**
```
agent:{agentId}:{channel}:{peerKind}:{peerId}        # group/channel
agent:{agentId}:{channel}:{accountId}:direct:{peerId} # DM
agent:{agentId}:main                                   # collapsed main
```

---

## 4. Session System

**Persistence:** JSONL files per session at `~/.openclaw/agents/<agentId>/`

**dmScope variants:**
- `"main"` — all DMs collapse to one session (default)
- `"per-peer"` — one session per sender
- `"per-channel-peer"` — one session per channel+sender
- `"per-account-channel-peer"` — most granular

**Compaction:** Triggered at ~90% context. Acquires write lock → validates transcript → LLM summarization → sliding window (keep last 12 messages verbatim).

**Visibility policy for inter-agent access:**
- `"self"` — own sessions only
- `"tree"` — self + spawned subagents (default)
- `"agent"` — all sessions for same agentId
- `"all"` — cross-agent (requires `agentToAgent.enabled: true`)

---

## 5. Skill System — 6-Source Precedence

Loading order (later overwrites earlier):
1. `{workspaceDir}/skills/` — workspace-local (highest priority)
2. `{workspaceDir}/.agents/skills/`
3. `~/.agents/skills/` — personal
4. `{CONFIG_DIR}/skills/` — managed via ClawHub
5. Bundled skills — ship with npm package
6. Extra dirs from config + plugins

**SKILL.md frontmatter:**
```yaml
---
skillKey: standup
emoji: 📊
os: macos          # OS constraint
always: false      # Always inject?
userInvocable: true
modelInvocable: true
---
```

Size limit: 256KB per skill. Max 300 candidates per directory.

---

## 6. Memory System — Hybrid RAG

`MemoryIndexManager` using SQLite with:
- `chunks_vec` — vector embeddings (sqlite-vec)
- `chunks_fts` — BM25 full-text search
- `embedding_cache` — cached vectors

**5 embedding providers:** OpenAI, Gemini, Voyage, Mistral, Ollama (automatic fallback)

**Search pipeline:**
1. Query expansion
2. Vector embedding
3. Parallel vector + BM25 search
4. MMR reranking (reduce redundancy)
5. Temporal decay weighting (recency bias)
6. Minimum score filtering

---

## 7. Inter-Agent Communication

**`runAgentStep()`** in `agents/tools/agent-step.ts`:
1. Generate idempotency key
2. `callGateway("agent", {message, sessionKey, channel: "INTERNAL_MESSAGE_CHANNEL"})`
3. Poll `callGateway("agent.wait", {runId})` — 60s timeout
4. Read response via `callGateway("chat.history", ...)`

**Subagent management** (`subagents-tool.ts`):
- `list` — active + recent subagent runs
- `kill` (target or `"all"`) — abort runs
- `steer` — send steering message to active subagent

**Access control:** `createAgentToAgentPolicy()`:
- `tools.agentToAgent.enabled: true` required
- `tools.agentToAgent.allow: ["agent-a", "agent-b"]` — glob support
- Default: `"tree"` visibility

---

## 8. Auth Profile Rotation

`MAX_RUN_LOOP_ITERATIONS` scales with auth profile count: `32 + 8× per profile, max 160`. On rate-limit or auth failure → rotate to next profile. Production-grade LLM reliability pattern.

---

## 9. What's Genuinely Innovative

1. **7-tier routing with WeakMap LRU** — O(1)-amortized, production-grade
2. **Session key encoding** — full routing context in filesystem-safe string, no DB needed
3. **ContextEngine as pluggable interface** — `ingest/assemble/compact/prepareSubagentSpawn/onSubagentEnded`
4. **Hybrid SQLite/sqlite-vec memory** — BM25 + vector + MMR + temporal decay = real RAG
5. **Auth profile rotation under load** — scaling iterations by profile count
6. **A2A visibility policy system** — `self/tree/agent/all` with explicit allowlist

---

## 10. What's Marketing Hype

1. **"Local-first"** — it's a Node.js process, no local inference by default
2. **"20+ channels"** — thin adapters around existing libraries
3. **"Lobster workflow shell"** — standard CLI REPL, branded
4. **ClawHub** — VS Code extension marketplace pattern, nothing novel

---

## 11. What Piaz Should Steal vs Build Differently

### Steal

| Pattern | Why |
|---------|-----|
| Session key format `agent:{id}:{channel}:{peer}` | No DB needed for session routing |
| 7-tier routing with LRU cache | Right mental model for multi-tenant |
| JSONL transcripts per session | Simple, appendable, no DB for basic persistence |
| `dmScope` variants | Precise operator control |
| ContextEngine pluggable interface | Right lifecycle hooks |
| A2A visibility policy `self/tree/agent/all` | Clean security model |
| Auth profile rotation | Production reliability |
| 6-source skill precedence | User override flexibility |

### Build Differently

| OpenClaw | Problem | Piaz Alternative |
|----------|---------|-----------------|
| Local-first gateway `ws://127.0.0.1` | Can't serve cloud SaaS | Gateway as cloud service with auth |
| Plugin SDK (158 files) | Too heavy | Lighter adapter interface |
| SQLite memory per-agent | No horizontal scaling | Postgres + pgvector for multi-tenant |
| SKILL.md markdown frontmatter | Fragile parsing | YAML config + TS module export |
| `sessions_spawn` polls with 60s timeout | Polling is brittle | Event streaming (SSE/WS push) |
| File-lock for session writes | Single-writer bottleneck | Optimistic locking or WAL |

---

*Generated: 2026-03-17 | Source: OpenClaw GitHub repository analysis*
