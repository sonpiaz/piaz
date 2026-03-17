# Viktor Architecture Analysis

*Deep dive into Viktor — the development/deployment agent in Son's multi-agent system*

---

## 1. What is Viktor?

Viktor is **Agent 3** in Son's multi-agent trio running on Mac Mini (100.106.143.17 via Tailscale):

| Agent | Role | Focus |
|-------|------|-------|
| EVOX (Main) | Coordination, research, docs | Mission control dashboard |
| Hidrix | Slack operations, team comms | Affitor workspace bot |
| **Viktor** | Development, deployment | Code agent |

Viktor is the **code-first agent** — responsible for writing, shipping, and maintaining code across Son's projects. While Hidrix handles communication and EVOX handles strategy, Viktor is the hands-on builder.

---

## 2. Architecture Position

```
┌─────────────────────────────────────────────┐
│              Mac Mini Host                   │
├─────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │  EVOX   │  │ Hidrix  │  │ Viktor  │      │
│  │ (Main)  │  │ (Slack) │  │ (Code)  │      │
│  └────┬────┘  └────┬────┘  └────┬────┘      │
│       │            │            │            │
│  ┌────┴────────────┴────────────┴────┐      │
│  │        Shared Workspace            │      │
│  │   memory/ | outputs/ | skills/     │      │
│  └────────────────────────────────────┘      │
│                    │                         │
│  ┌─────────────────┴─────────────────┐      │
│  │         Messaging Hub              │      │
│  │  Telegram | Slack | Discord        │      │
│  └───────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

### Viktor's Unique Position

Viktor operates as a **narrow development agent** following the 7-10 skills rule:

- **Primary skills**: Git operations, code generation, testing, deployment, PR management
- **Not responsible for**: Communication (Hidrix), research (EVOX/Dwight), content (Kelly/Pam)
- **Reliability target**: ~90% (narrow agent standard vs ~60% general agent)

---

## 3. Design Principles

### 3.1 Narrow Agent Philosophy

From the multi-agent architecture analysis, Viktor follows the principle that **narrow agents with 7-10 skills outperform general-purpose agents**:

1. **Context efficiency** — Fewer skills = fewer tokens in system prompt
2. **Decision clarity** — No confusion about which tool to use
3. **Quality focus** — Optimized for one outcome: shipping code
4. **Easier debugging** — Failure modes are clear

### 3.2 Specialization Scope

| Capability | Viktor | Notes |
|-----------|--------|-------|
| Code generation | Yes | Primary function |
| Git operations | Yes | Commits, branches, PRs |
| Testing | Yes | Run tests, verify builds |
| Deployment | Yes | Push to staging/production |
| PR review | Yes | Code quality checks |
| Documentation | Limited | Only code-adjacent docs |
| Research | No | Delegated to research agents |
| Communication | No | Delegated to Hidrix |

---

## 4. Communication Patterns

### 4.1 File-based Coordination

Viktor communicates with other agents through the shared workspace:

```
~/.openclaw/workspace/
├── memory/*.md          — Shared context (all agents read/write)
├── outputs/             — Deliverables (Viktor writes code artifacts)
├── checkpoints/         — Work-in-progress (Viktor saves build state)
└── shared/handoffs/     — Agent-to-agent task passing
```

### 4.2 Session Messaging

```javascript
// Viktor receives tasks from Monica (coordinator)
sessions_history({ sessionKey: "agent:monica:session:xyz" })

// Viktor reports completion back
sessions_send({
  agentId: "monica",
  message: "PR #456 merged. Build passing. Deployed to staging."
})

// Viktor requests research from Dwight
sessions_send({
  agentId: "dwight",
  message: "Need API docs for Stripe Connect v2. Deliver to checkpoints/stripe-research.md"
})
```

### 4.3 Handoff Protocol

```
Monica assigns task → Viktor picks up from handoffs/
Viktor needs docs → Pam receives handoff
Viktor needs research → Dwight receives handoff
Viktor done → Reports to Monica
```

---

## 5. Execution Model

### 5.1 Task Pipeline

```
1. RECEIVE task (from cron, handoff, or direct message)
       ↓
2. ANALYZE requirements (read context, check dependencies)
       ↓
3. PLAN implementation (branch strategy, file changes)
       ↓
4. EXECUTE code changes (write, test, iterate)
       ↓
5. VERIFY (run tests, build check, self-review)
       ↓
6. SHIP (commit, push, create PR)
       ↓
7. REPORT (status update to coordinator)
```

### 5.2 Sub-Agent Spawning

Viktor can spawn sub-agents for parallel work:

```typescript
// Example: Multiple independent code tasks
sessions_spawn({
  task: "Fix linting errors in src/api/",
  label: "Lint Fix Agent",
  model: "claude-sonnet-4-5"  // Cheaper for simple tasks
})

sessions_spawn({
  task: "Write unit tests for UserService",
  label: "Test Writer Agent",
  model: "claude-opus-4-5"  // Quality matters for tests
})
```

### 5.3 Checkpoint Strategy

Viktor saves intermediate state to enable resumption:

```
checkpoints/
├── current-task.json       — What Viktor is working on
├── build-state.json        — Last successful build info
├── pr-queue.json           — PRs awaiting review/merge
└── deploy-log.json         — Recent deployment history
```

---

## 6. Integration with Son's Projects

### 6.1 Hidrix Development

Viktor's primary development target is Hidrix (the Slack bot):

- **Repo**: github.com/sonpiaz/hidrix
- **Stack**: TypeScript + Slack Bolt + Anthropic SDK
- **Workflow**: `feat/xxx` → PR to `uat` → test → PR to `main`
- **Deploy target**: Mac Mini via GitHub integration

### 6.2 EVOX Development

Secondary target — the mission control dashboard:

- **Repo**: github.com/sonpiaz/evox
- **Stack**: Next.js 14 + Convex + shadcn/ui
- **Deploy**: Vercel (evox-ten.vercel.app)

### 6.3 Affitor Platform

Tertiary — the affiliate SaaS:

- **Repos**: github.com/Affitor/* (5 private repos)
- **More complex, requires careful coordination**

---

## 7. Comparison: Viktor vs OpenClaw Code Agents

| Aspect | Viktor | OpenClaw Ross/Code Agent |
|--------|--------|--------------------------|
| **Runtime** | OpenClaw Gateway on Mac Mini | Same Gateway |
| **Model** | Opus 4.5/4.6 | Configurable |
| **Scope** | Son's specific projects | Generic code tasks |
| **Git workflow** | Affitor Standard (feat → uat → main) | Configurable |
| **Skills count** | 7-10 (narrow) | Variable |
| **Coordination** | File + session messaging | Same |
| **Autonomy** | High (can ship without approval for non-sensitive) | Depends on config |

---

## 8. Recommendations for Viktor Evolution

### Short-term
1. **Formalize skill set** — Define exactly which 7-10 skills Viktor needs
2. **Add metrics tracking** — Token usage, task success rate, PR merge rate
3. **Implement Journal pattern** — Log all actions for audit trail

### Medium-term
4. **Self-improving test coverage** — Viktor should increase test coverage with each PR
5. **Automated deployment pipeline** — Reduce manual steps in shipping
6. **Cross-project dependency awareness** — Know when Hidrix changes affect EVOX

### Long-term
7. **Code review agent capability** — Viktor reviews its own code before shipping
8. **Performance regression detection** — Monitor build times, test execution
9. **Predictive task estimation** — Learn from past tasks to estimate new ones

---

## References

- [Multi-Agent Architecture Analysis](../outputs/multi-agent-architecture-analysis.md)
- [OpenClaw Architecture Breakdown](../outputs/openclaw-architecture-breakdown.md)
- [Setup 8 Agents Guide](../outputs/SETUP-8-AGENTS-GUIDE.md)
- [How I Work — OpenClaw Deep Dive](../outputs/how-i-work.md)

---

*Generated: 2026-03-16*
