# Viktor (getviktor.com) — Product & Architecture Analysis

*Competitor analysis for Piaz positioning*

---

## Overview

| Field | Detail |
|-------|--------|
| **Company** | Zeta Labs (ZETA AI, Inc., US) |
| **Founders** | Fryderyk Wiatrowski (ex-Meta, Oxford) + Peter Albert (ex-Meta Llama 2) |
| **Funding** | $2.9M pre-seed (Daniel Gross + Nat Friedman) |
| **Launch** | March 3, 2026 — Product Hunt #4 of the Day (321 upvotes) |
| **Users** | 1,000+ teams |
| **Platform** | Slack + Microsoft Teams |
| **Tagline** | "Your last hire" |

---

## 1. How Viktor Works

### Onboarding (5 minutes)
1. Sign up at app.getviktor.com/signup
2. Authorize for Slack workspace via OAuth
3. Connect business tools from dashboard (one-click OAuth)
4. @Viktor in any channel or DM

### Interaction Model
- Any team member @mentions Viktor in Slack thread/channel
- Natural language requests — no prompt engineering
- Viktor decides tools, executes, delivers results in-chat
- Shared workspace resource — one install covers entire team

### Proactive Behavior
- Watches channels, chimes in when relevant
- Threshold-based suggestions (not aggressive)
- Scheduled heartbeats: daily standups, weekly audits, monthly reports

---

## 2. Technical Architecture

### Execution Model
- Each workspace gets an **isolated cloud VM**
- Agent writes and runs **Python code** (not JSON function schemas)
- Enables loops, conditionals, error handling in single turn

### Tool Loading (Lazy)
- ~68 one-line summaries in system prompt
- Full skill file loaded only when needed
- Avoids context waste from 3,000+ tool schemas upfront

### LLM Stack
- **Primary:** Claude Opus 4.6
- **Secondary:** Google Gemini Flash 3.0 (lighter tasks)

### Infrastructure
- AWS encrypted databases + Cloudflare R2
- US-based, 30-day data retention after closure
- SOC 2 Type 1 certified (Type 2 in progress)
- GDPR aligned, CCPA compliant, CASA Tier 3

### Security
- Credential injection server-side — LLM never sees API keys
- Approval gates for high-impact actions

---

## 3. Pricing

| Tier | Price | Credits |
|------|-------|---------|
| Starter | Free | $100 one-time credits/workspace |
| Team | $50/workspace/month | 20,000 monthly credits |
| Enterprise | Custom | Custom + SLA, DPA |

**Key:** Per-workspace, not per-user. Claude in Slack = $25-30/user/month (10-person team = $625+/mo). Viktor = flat $50/mo.

---

## 4. Integrations

3,000+ via OAuth including: Salesforce, HubSpot, GitHub, Linear, Google Ads, Meta Ads, PostHog, Stripe, Notion, Google Drive, Jira, Asana.

**Output types:** PDFs, Excel, PowerPoint, deployed web apps, PRs, campaign adjustments, emails, tickets.

---

## 5. Strengths & Weaknesses

### Strengths
- Execution-oriented (not just suggestions)
- Fast setup — no developer needed
- Per-workspace pricing (cheaper for teams)
- Proactive monitoring catches anomalies
- Growing more useful over time (shared memory)
- Official Slack Marketplace listing

### Weaknesses
- **Credit opacity** — unclear depletion rate, mid-task interruptions
- **Slack-only lock-in** — no Discord, Telegram, email-native
- **Shared integration privacy** — no RBAC (all users share tokens)
- **No private mode** — sees all channels it's invited to
- **No multi-agent** — single "Viktor" persona, no specialized agents
- **No marketplace** — can't hire domain-specific agents
- **No self-host option** — cloud-only, no on-premise

---

## 6. Piaz vs Viktor — Differentiation Vectors

| Dimension | Viktor | Piaz (Target) |
|-----------|--------|---------------|
| Platform | Slack + Teams | **Telegram** (underserved market) |
| Agent model | Single generic agent | **Multi-agent marketplace** |
| Pricing | Credits (opaque) | **Per-agent hire** (transparent) |
| Self-host | No | **Open core** (cloud + self-host) |
| RBAC | Missing | **Per-agent permissions** |
| Onboarding | 5 min | **30 seconds** |
| Market | US enterprise | **VN dog food → US/EU** |
| LLM cost | Hidden in credits | **Direct API pass-through** (transparent) |

### Viktor's Weaknesses = Piaz's Opportunities

1. **No Telegram** — Piaz owns the Telegram-first market
2. **No multi-agent** — Piaz's core innovation (hire specialized agents)
3. **Credit opacity** — Piaz's per-agent transparent pricing wins trust
4. **No self-host** — Piaz open core captures developer market
5. **No RBAC** — Piaz's per-agent isolation solves this by design
6. **Slack-only** — 800M+ Telegram users unserved

---

## 7. What Piaz Should Learn from Viktor

1. **Code execution sandbox** — Viktor's cloud VM approach is powerful. Piaz agents should also be able to write+run code, not just call pre-defined tools
2. **Lazy skill loading** — 68 one-line summaries + full load on demand. Matches the 7-10 skills rule
3. **Shared memory grows value** — One person's correction benefits everyone. Company Brain concept
4. **Approval gates** — High-impact actions need confirmation. Essential for trust
5. **Proactive heartbeats** — Don't just react. Scheduled monitoring creates "always-on teammate" feeling
6. **Per-workspace pricing** — Simpler than per-user. Piaz's per-agent model is even better (more granular)

---

*Generated: 2026-03-17*
*Sources: getviktor.com, Product Hunt, Futurepedia, aipure.ai, Crunchbase*
