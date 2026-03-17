# OpenClaw — GitHub Research & Analysis

*Comprehensive research on the OpenClaw open-source project*

---

## Overview

| Field | Detail |
|-------|--------|
| **Repo** | [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) |
| **Description** | "Your own personal AI assistant. Any OS. Any Platform. The lobster way." |
| **Stars** | 318,000+ (surpassed React as most-starred repo on GitHub) |
| **Forks** | 61,100+ |
| **Launch** | November 24, 2025 |
| **Organization** | [github.com/openclaw](https://github.com/openclaw) — 23 repositories |
| **Lead** | peter@openclaw.ai |
| **Sponsors** | OpenAI, Vercel, Blacksmith, Convex |

---

## What is OpenClaw?

OpenClaw is a **local-first, open-source personal AI assistant** that runs on your own hardware — Mac, Linux, Windows, Raspberry Pi, iOS, Android.

Key differentiator: **You run a Gateway on your machine**, and the assistant communicates through whatever channels you already use — WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Microsoft Teams, Matrix, IRC, and 15+ more.

---

## Architecture

### Core: Gateway WebSocket Control Plane

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│  Telegram / Discord / Signal / Slack / WhatsApp / CLI       │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    OPENCLAW GATEWAY                          │
│  Node.js daemon (ws://127.0.0.1:18789)                      │
│  - Channel adapters                                         │
│  - Session management + isolation per chat/group            │
│  - Message routing                                          │
│  - Cron scheduler                                           │
│  - Tool implementation                                      │
│  - Media pipeline (images, audio, video)                    │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    LLM PROVIDERS                             │
│  OpenAI / Anthropic / Ollama / vLLM / SGLang                │
│  (Provider-plugin architecture as of March 2026)            │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Primary language | TypeScript |
| Runtime | Node.js >= 22 |
| Package manager | pnpm / npm / bun |
| UI | React |
| Testing | Vitest |
| Deployment | Docker, Kubernetes, Nix, launchd daemon |
| Companion apps | Swift (iOS/macOS), C# (Windows), Python (skills) |
| Skill registry | Convex + TanStack Start |
| Skill search | OpenAI embeddings (`text-embedding-3-small`) |

---

## Key Features

### 1. Multi-Channel Inbox (20+ platforms)
WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Teams, Matrix, Feishu, LINE, Nostr, Twitch, Zalo, and more.

### 2. Voice
Wake words on macOS/iOS, continuous voice on Android.

### 3. Live Canvas
Agent-driven visual workspace with A2UI (Agent-to-UI) support.

### 4. Browser Control
Chromium DevTools attach mode with batched browser actions.

### 5. Skills Platform (ClawHub)
- Publishable, versioned SKILL.md-based plugins
- Vector search for skill discovery
- **5,400+ community skills** catalogued
- Repo: [github.com/openclaw/clawhub](https://github.com/openclaw/clawhub) (6,100 stars)

### 6. Lobster Workflow Shell
A typed, local-first macro engine that turns skills/tools into composable pipelines and safe automations.

### 7. Cron Jobs, Webhooks, Nodes
First-class scheduling and automation primitives.

### 8. Companion Apps
macOS menu bar, iOS (with Home canvas), Android, Windows system tray (C#).

### 9. Memory System
Multimodal memory indexing (as of March 2026).

---

## Multi-Agent Capabilities

OpenClaw has **explicit multi-agent coordination** built into the platform:

### Session Tools

| Tool | Purpose |
|------|---------|
| `sessions_list` | Discover active sessions (agents) and metadata |
| `sessions_history` | Fetch transcript logs from other agent sessions |
| `sessions_send` | Send messages between agents with optional reply-back |
| `sessions_yield` | Subagent tool for immediate turn completion (March 2026) |
| `sessions_spawn` | Create isolated sub-agent sessions |

### Agent-to-Agent Communication

```typescript
// Spawn a sub-agent
sessions_spawn({
  task: "Research market size with sources",
  label: "Market Research Agent",
  model: "claude-opus-4-5",
  runTimeoutSeconds: 300,
  cleanup: "keep"
})

// Send message to another agent
sessions_send({
  agentId: "pam",
  message: "PR #123 needs documentation"
})

// Check on other agents
sessions_list({ kinds: ["isolated"] })
sessions_history({ sessionKey: "agent:main:spawn:xyz" })
```

---

## Ecosystem Projects

| Project | Repo | Description |
|---------|------|-------------|
| **ClawHub** | openclaw/clawhub | Skill directory — 5,400+ skills |
| **ClawWork** | HKUDS/ClawWork | "OpenClaw as Your AI Coworker" — multi-agent work coordination |
| **OpenClaw-RL** | Gen-Verse/OpenClaw-RL | Async RL framework for personalized agents |
| **Mission Control** | abhi1693/openclaw-mission-control | Centralized orchestration dashboard |
| **Symphony** | — | Autonomous implementation runs for coding agents |
| **awesome-openclaw-skills** | VoltAgent/awesome-openclaw-skills | Community skill curation |

---

## Relevance to Son's Setup

### What Son Already Uses from OpenClaw

1. **Gateway daemon** on Mac Mini — always-on agent runtime
2. **Multi-agent sessions** — EVOX, Hidrix, Viktor running simultaneously
3. **Cron scheduling** — Automated tasks on schedule
4. **File-based memory** — `memory/*.md` shared workspace
5. **Telegram/Slack channels** — Multi-channel messaging

### What Son Could Adopt

1. **ClawHub skills** — Leverage 5,400+ community skills instead of building from scratch
2. **Lobster workflow shell** — Composable automation pipelines
3. **Live Canvas** — Visual workspace for EVOX dashboard
4. **Sessions_yield** — Better sub-agent management
5. **Multimodal memory** — Beyond text-only memory files

### Architecture Comparison

| Aspect | Son's Current | OpenClaw Standard |
|--------|--------------|-------------------|
| Agents | 3 (EVOX, Hidrix, Viktor) | 8+ recommended |
| Coordination | File + Slack | Sessions API + files |
| Skills per agent | Varies | 7-10 (narrow agent rule) |
| Channel coverage | Slack, Telegram | 20+ channels |
| Skill marketplace | Custom only | ClawHub ecosystem |

---

## Activity & Growth

| Metric | Value |
|--------|-------|
| Stars | 318,000 |
| Forks | 61,100 |
| Open Issues | 5,000+ |
| Open PRs | 5,000+ |
| Org repos | 23 |
| Release cadence | Daily (v2026.3.11 → v2026.3.13 in 3 days) |
| Time to 200K stars | 84 days |
| Growth rate | Fastest-growing repo on GitHub |

---

## Key Takeaways

1. **OpenClaw validates Son's approach** — Local-first, multi-agent, file-based coordination is the winning pattern
2. **Narrow agents > general agents** — The 7-10 skills rule is now industry standard
3. **The ecosystem matters** — ClawHub's 5,400+ skills create a moat
4. **Multi-channel is essential** — Users want agents where they already communicate
5. **Voice is the next frontier** — Wake words and continuous voice are differentiators

---

*Generated: 2026-03-16*
*Sources: GitHub, WebProNews, OpenClaw documentation*
