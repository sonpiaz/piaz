# Piaz — TODOs

## Phase 0 Must-Do

### R2 Write Failure Resilience
- **What:** Add retry (3x exponential backoff) + local buffer queue for R2 JSONL write failures + drain queue on reconnect
- **Why:** Cloud deployment means JSONL writes go over network. Any R2 blip silently loses conversation context. OpenClaw avoids this by using local JSONL (no network) — Piaz on Railway can't.
- **Pros:** Zero data loss for session transcripts
- **Cons:** ~50 lines of code, adds local disk buffer as fallback
- **Where to start:** `src/sessions/r2-writer.ts` — wrap R2 SDK `putObject` with retry + `src/sessions/local-buffer.ts` for queue
- **Depends on:** R2 SDK integration, session-mgr.ts complete

## Built Into Phase 0 (not deferred)

### pgvector Timeout Fallback
- **What:** 5s timeout on vector search, auto-fallback to BM25-only, log warning
- **Why:** Slow embedding query blocks entire response. Users see nothing instead of slightly-less-accurate answer.
- **Where:** `src/brain/search.ts` — `Promise.race([vectorSearch(), timeout(5000)])` + BM25 fallback
- **Status:** Will be built into initial implementation

## Deferred (Not Phase 0)

### Agent Marketplace
- **What:** Browse, hire, rate specialized agents
- **Why:** Core differentiator vs Viktor, but single Piaz Core agent must prove value first
- **Blocked by:** Phase 0 complete, 10+ orgs using the bot

### Per-Agent Billing (Stripe)
- **What:** Usage tracking per agent per org, Stripe usage-based billing
- **Why:** Revenue model, but premature before product-market fit
- **Blocked by:** Agent marketplace, 10+ paying customers

### Code Execution Sandbox
- **What:** Isolated VM/container for agents to write+run code (like Viktor)
- **Why:** Enables agents that DO things, not just answer questions
- **Blocked by:** Phase 0 stable, security review

### Cron / Proactive Engine
- **What:** Scheduled agent tasks + heartbeat monitoring (like Viktor/OpenClaw)
- **Why:** "Always-on teammate" UX, not just reactive Q&A
- **Blocked by:** Phase 0 stable, at least 1 use case identified

### Auth Profile Rotation
- **What:** Multiple API keys per provider, rotate on rate-limit (OpenClaw pattern)
- **Why:** Production reliability at scale
- **Blocked by:** Hitting rate limits (means we have real usage)

### piaz.ai Landing Page
- **What:** Next.js site with signup flow + dashboard
- **Why:** Distribution channel, but Telegram-only onboarding works for early users
- **Blocked by:** Phase 0 deployed, ready for public launch
