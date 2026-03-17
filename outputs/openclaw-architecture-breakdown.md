# OpenClaw Architecture: Complete Technical Breakdown

*Generated: 2026-02-18 | For: Hidrix Development Reference*

---

## 1. Long Output Generation

### How It Actually Works

I don't have a special "long output mode." Claude's output limit per turn is ~16K tokens (roughly 12K-15K words). For anything longer, the architecture uses **multi-turn continuation** or **file-based assembly**.

**Pattern 1: Direct File Writing**
```
User: "Write a 50-page report"
↓
Agent turn 1: Generate outline, write chapters 1-3 to file
Agent turn 2: Continue chapters 4-7
Agent turn 3: Finish chapters 8-10, compile
↓
Deliver file
```

The key insight: **I write to disk, not to chat.** The 350-page AI Agent Economy report wasn't generated in one response — it was built across multiple agent turns, with each turn appending to files on disk.

**Pattern 2: Chunked Generation with Coherence**
```python
# Pseudo-code for what happens:

def generate_long_document(outline):
    # Step 1: Generate detailed outline with key decisions
    outline = generate_outline(topic)
    write_file("outline.md", outline)
    
    # Step 2: For each section, generate with context injection
    for section in outline.sections:
        # Inject prior context summary + style guide
        context = f"""
        Document: {outline.title}
        Prior sections summary: {summarize(completed_sections)}
        Style guide: {style_rules}
        Current section: {section.title}
        """
        content = generate_section(context)
        append_file("report.md", content)
    
    # Step 3: Compile and cross-reference
    full_doc = read_file("report.md")
    final = add_cross_references(full_doc)
    convert_to_docx(final)
```

### Coherence Across Long Documents

**Strategy 1: Style Guide Up Front**
Before generating, I create explicit rules:
```markdown
## Style Guide for This Document
- Use "AI agents" not "AI assistants"
- All numbers in billions formatted as "$X.XB"
- Chapters use H1, sections H2, subsections H3
- Every claim needs [Source: X] citation
```

This gets injected into context for each section.

**Strategy 2: Summary Propagation**
After each major section, I generate a 2-3 sentence summary of key decisions/facts established. This summary gets prepended to context for subsequent sections.

**Strategy 3: Terminology Index**
For complex reports, I maintain a running glossary:
```markdown
## Established Terms
- "Agent Economy" = market for AI agent services (defined Ch 1)
- "TAM" = $47B by 2028 (sourced from Gartner)
```

### Maximum Observed Output

- Single turn: ~16K tokens
- Single task with continuation: No hard limit — I've generated 200+ page documents
- The 350-page estimate was **total content including research, drafts, appendices** — not a single continuous generation

### What Enables It

1. **File system as external memory** — I write incrementally to disk
2. **Tool calls between turns** — each `write_file` persists state
3. **Session continuity** — OpenClaw maintains my session across tool calls
4. **Explicit checkpointing** — I save progress so I can resume

---

## 2. Sub-Agent Spawning

### The Actual API

```typescript
// What I call internally:
sessions_spawn({
  task: "Research AI agent market size with sources",
  label: "Market Research Agent",
  model: "claude-opus-4-5",  // or different model
  runTimeoutSeconds: 300,
  cleanup: "keep"  // or "delete" after completion
})
```

This creates an **isolated session** that:
- Gets its own context window
- Runs independently (async)
- Reports results back to the spawning chat

### When to Spawn vs Handle Inline

**Spawn when:**
1. Task is **embarrassingly parallel** — 5 independent research topics
2. Task requires **different expertise** — code review vs prose editing
3. Task would **blow context** — researching 20 sources would fill my window
4. User expects **status updates** — spawn runs in background, I can respond immediately

**Inline when:**
1. Task is **sequential** — step 2 depends on step 1
2. Task is **quick** — under 30 seconds
3. **Coherence matters** — single voice, consistent style
4. **Context is critical** — I need all prior conversation

### Communication Protocol

**Spawning (parent → child):**
```typescript
sessions_spawn({
  task: `
    Research market size for AI agents.
    Requirements:
    - Find 3+ sources with actual numbers
    - Note methodology of each estimate
    - Flag any conflicting data
    Output format: Markdown with source citations
  `,
  ...
})
```

The child gets:
- The task description
- System prompt (SOUL.md, AGENTS.md, etc.)
- Its own clean context window
- Access to same tools (web_search, file operations, etc.)

**Reporting (child → parent):**
When sub-agent completes, OpenClaw automatically delivers the result back to the original chat:
```
🤖 Sub-agent "Market Research" completed:

[Full output from sub-agent here]
```

I (the parent) can also check on sub-agents:
```typescript
sessions_list({ kinds: ["isolated"] })  // See all spawned agents
sessions_history({ sessionKey: "agent:main:spawn:xyz" })  // Read their work
```

### Merging Results

**Pattern: Checkpoint Files**
```
# Parent orchestration:

1. Spawn 3 sub-agents:
   - Agent A: Research -> writes to checkpoints/research-a.md
   - Agent B: Research -> writes to checkpoints/research-b.md  
   - Agent C: Research -> writes to checkpoints/research-c.md

2. Parent polls/waits for completion

3. Parent reads all checkpoint files

4. Parent synthesizes into final output
```

**Pattern: Direct Output**
For simpler tasks, sub-agents just return their output directly (via the announcement mechanism), and I compile in my response.

### Can Sub-Agents Spawn Sub-Agents?

**Yes**, but we limit depth to avoid runaway spawning. Typically:
- Main agent → spawns 2-3 task agents
- Task agents → rarely spawn (handle inline)
- Max practical depth: 2

### Failure Handling

```typescript
// Sub-agent has timeout
sessions_spawn({
  task: "...",
  runTimeoutSeconds: 300,  // Kill after 5 min
  ...
})
```

**Failure modes:**
1. **Timeout**: Session killed, parent notified "timed out"
2. **Error**: Error message returned to parent chat
3. **Empty result**: Parent checks and can re-spawn or handle

**Recovery pattern:**
```
If sub-agent fails:
1. Check sessions_history to see what it attempted
2. Decide: retry, handle inline, or report failure to user
3. Usually: "Sub-agent hit an issue, let me handle this directly..."
```

### Model Selection for Sub-Agents

Default: **Same model as parent** (currently Opus 4.5)

Can override:
```typescript
sessions_spawn({
  task: "...",
  model: "claude-sonnet-4",  // Cheaper/faster for simple tasks
  ...
})
```

**Strategy:**
- Research/simple tasks → Sonnet (faster, cheaper)
- Synthesis/complex reasoning → Opus
- Code generation → either works

---

## 3. Multi-Step Task Execution with Intermediate Delivery

### The Message Tool

```typescript
// I can send messages at any point during execution:
message({
  action: "send",
  message: "Found 6 relevant documents. Reading now...",
  // channel auto-detected from session
})
```

This sends immediately, then I continue working.

### Pattern: Progress Updates

```python
# Pseudo-flow:

def complex_task(request):
    # Step 1: Initial acknowledgment (automatic - my response)
    respond("On it. This will take a few minutes.")
    
    # Step 2: Research phase
    results = web_search(query)
    message("Found 8 sources. Analyzing...")
    
    # Step 3: Deep processing
    for source in results:
        content = web_fetch(source.url)
        analyze(content)
    message("Analysis complete. Compiling report...")
    
    # Step 4: Generation
    report = generate_report(analyses)
    write_file("report.md", report)
    
    # Step 5: Delivery
    message("Here's the report: [file attached]")
```

### Streaming vs Complete Delivery

**I don't stream tokens** — Claude's API streams, but my tool-calling architecture works in complete turns.

**What I do instead:**
1. **Chunked delivery**: Send partial results as messages
2. **File-based**: Write to file, deliver file at end
3. **Progress indicators**: "Step 2/5: Analyzing sources..."

### Intermediate State

```python
# Between steps, I can:

# 1. Write to workspace files
write_file("working/step1-results.json", data)

# 2. Update status files
write_file("WORKING.md", """
## Current Task: Market Analysis
- [x] Research phase
- [ ] Analysis phase  
- [ ] Report generation
""")

# 3. Send user updates
message("Completed research. Found 12 relevant papers...")
```

---

## 4. Complex Document Assembly

### The 350-Page Pipeline (Actual Process Used)

```
Phase 1: Planning (1 agent turn)
├── Define scope and outline
├── Create chapter structure
├── Write style guide
└── Output: outline.md, style-guide.md

Phase 2: Research (parallel sub-agents)
├── Agent A: Market sizing research → research/market.md
├── Agent B: Technical landscape → research/tech.md
├── Agent C: Case studies → research/cases.md
└── Parent: Monitor and collect

Phase 3: Writing (sequential, 2-3 chapters per turn)
├── Turn 1: Executive summary + Ch 1-2
├── Turn 2: Ch 3-5
├── Turn 3: Ch 6-8
├── Turn 4: Ch 9-11
└── Each turn: Read prior chapters summary, inject style guide

Phase 4: Assembly
├── Combine all chapter files
├── Add cross-references
├── Generate TOC
├── Add appendices
└── Convert to DOCX

Phase 5: Delivery
├── Upload to Google Drive (via rclone)
├── Send link to user
└── Archive working files
```

### Outline → Section → Content

**Level 1: High-Level Outline**
```markdown
# AI Agent Economy Report 2026
1. Executive Summary
2. Market Overview
   2.1 Current State
   2.2 Growth Projections
3. Technical Architecture
   ...
```

**Level 2: Section Expansion**
For each section, I generate with:
```
Context:
- Document purpose: [from outline]
- This section's goal: [specific]
- Prior sections established: [summary]
- Style requirements: [from guide]

Generate section 2.1 "Current State" (target: 3-5 pages)
```

**Level 3: Consistency Passes**
After draft complete:
1. **Terminology pass**: Search/replace inconsistencies
2. **Number verification**: Cross-check all statistics
3. **Reference pass**: Add "as discussed in Section X"
4. **Formatting pass**: Ensure consistent headers, bullets, etc.

### File Format and Delivery

**Working format**: Markdown (easy to edit, version)

**Delivery formats**:
```bash
# Convert markdown to DOCX with pandoc
pandoc report.md -o report.docx --reference-doc=template.docx

# Or create PDF
pandoc report.md -o report.pdf --pdf-engine=xelatex
```

**Delivery methods**:
1. Direct file attachment (small files)
2. Google Drive upload (large files) via `rclone copy`
3. Generate download link

---

## 5. Architecture Overview

### Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│  Telegram / Discord / Signal / Slack / WhatsApp / CLI       │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    OPENCLAW GATEWAY                          │
│  Node.js daemon running on Mac Mini                          │
│  - Channel adapters (Telegram bot, Discord bot, etc.)       │
│  - Session management                                        │
│  - Message routing                                           │
│  - Cron scheduler                                            │
│  - Tool implementation                                       │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    ANTHROPIC API                             │
│  Claude Opus 4.5 / Sonnet 4                                 │
│  - Streaming responses                                       │
│  - Tool use (function calling)                              │
│  - Extended thinking (optional)                             │
└─────────────────────────────────────────────────────────────┘
```

### Context Window Management

**Current model**: Claude Opus 4.5 — 200K token context

**What fills context**:
1. System prompt (~8-10K tokens): SOUL.md, AGENTS.md, etc.
2. Conversation history: All prior turns
3. Tool results: File contents, search results, etc.

**Management strategies**:

1. **Compaction**: When context fills up (~180K), OpenClaw summarizes old conversation and starts fresh with summary
   ```
   "The conversation history before this point was compacted into the following summary: [summary]"
   ```

2. **External memory**: Instead of keeping everything in context, I write to files:
   ```
   # Instead of holding 50 pages in context:
   write_file("research/findings.md", content)
   
   # Later, read just what I need:
   read_file("research/findings.md", lines=50)  # First 50 lines only
   ```

3. **Selective tool output**: When reading large files:
   ```typescript
   Read({ path: "big-file.md", offset: 100, limit: 50 })  // Lines 100-150 only
   ```

### Persistent State

**Session transcript**: Every turn saved to `.jsonl` file
```
~/.openclaw/agents/main/sessions/[session-id].jsonl
```

**Workspace files**: My working directory persists across sessions
```
~/.openclaw/workspace/
├── MEMORY.md          # Long-term curated memory
├── memory/            # Daily notes
│   ├── 2026-02-18.md
│   └── 2026-02-17.md
├── outputs/           # Deliverables
├── checkpoints/       # Work in progress
└── ...
```

**Memory system**:
```typescript
// Search across memory files
memory_search({ query: "Affitor market size" })

// Get specific content
memory_get({ path: "memory/2026-02-18.md", from: 10, lines: 20 })
```

### Rate Limits and Token Budgets

**Anthropic tier**: OpenClaw uses API directly (not consumer tier)

**Per-turn limits**:
- Input: ~200K tokens (context window)
- Output: ~16K tokens (per response)

**Cost management**:
- Sub-agents can use cheaper models
- Context compaction reduces token usage
- File-based working reduces re-sending content

### Concurrency Model

**Parallel execution**: Via sub-agents
```typescript
// These run concurrently:
sessions_spawn({ task: "Research topic A", label: "Research A" })
sessions_spawn({ task: "Research topic B", label: "Research B" })
sessions_spawn({ task: "Research topic C", label: "Research C" })

// Parent continues immediately
respond("Spawned 3 research agents. I'll compile when they finish.")
```

**Sequential execution**: Within a single session, I'm single-threaded
- One turn completes before next starts
- Tool calls are blocking (I wait for result)

**Background processes**: Via `exec` with `background: true`
```typescript
exec({ 
  command: "python long_script.py",
  background: true,
  yieldMs: 1000  // Check after 1 second, background if still running
})
```

---

## 6. Patterns You Can Steal

### Pattern 1: File System as Memory

**Problem**: Context window fills up, loses coherence
**Solution**: Write intermediate results to disk, read selectively

```python
# DON'T: Keep accumulating in context
context += new_research_results  # Eventually blows up

# DO: Write to disk, reference by path
write_file("research/source-1.md", results)
# Later: read only what you need
relevant = read_file("research/source-1.md", lines=20)
```

### Pattern 2: Structured Handoff to Sub-Agents

**Problem**: Sub-agent doesn't know context, produces garbage
**Solution**: Explicit task specification with all needed context

```typescript
sessions_spawn({
  task: `
    ## Task
    Research competitive landscape for AI affiliate platforms.
    
    ## Context
    - We're building Affitor, an AI-focused affiliate platform
    - Target customers: AI SaaS companies (Cursor, Windsurf, etc.)
    - Need: 3-5 competitors with their pricing models
    
    ## Output Format
    Markdown table with columns:
    | Company | Pricing Model | Commission Rate | Notable Clients |
    
    ## Quality Bar
    - Only include companies with actual AI focus
    - Need source URL for each claim
    - Flag any unverified information with [unverified]
  `
})
```

### Pattern 3: Checkpoint-Based Long Tasks

**Problem**: Long task fails midway, lose all progress
**Solution**: Save checkpoints, enable resumption

```python
def long_task():
    # Check for existing progress
    if file_exists("checkpoints/step2.json"):
        state = load("checkpoints/step2.json")
        resume_from_step(2, state)
    else:
        step1_result = do_step1()
        save("checkpoints/step1.json", step1_result)
        
        step2_result = do_step2(step1_result)
        save("checkpoints/step2.json", step2_result)
        
        # ...
```

### Pattern 4: Style Guide Injection

**Problem**: Long document becomes inconsistent
**Solution**: Create explicit rules, inject into every generation call

```markdown
# style-guide.md
## Terminology
- "AI agents" not "AI assistants" or "bots"
- "Users" not "customers" when referring to end-users

## Formatting  
- All dollar amounts: $X.XM or $X.XB
- Percentages: X.X% (one decimal)
- Citations: [Source: Company Name, Date]

## Voice
- Active voice preferred
- Present tense for current state
- Confident but not hyperbolic
```

Then for each section:
```python
generate(f"""
{style_guide}

## Your Task
Write section 3.2 on "Market Sizing Methodology"
{section_context}
""")
```

### Pattern 5: Progress Communication

**Problem**: User waiting in the dark during long task
**Solution**: Proactive status updates

```python
def research_task():
    message("Starting research... this will take 2-3 minutes")
    
    sources = search(query)
    message(f"Found {len(sources)} sources. Analyzing...")
    
    for i, source in enumerate(sources):
        if i % 3 == 0:  # Update every 3 sources
            message(f"Processed {i}/{len(sources)} sources...")
        analyze(source)
    
    message("Analysis complete. Generating report...")
    report = generate_report()
    
    message("Done! Here's your report: [attachment]")
```

### Recommendations for Hidrix

1. **Don't fight the token limit — work with it**
   - Embrace file-based working
   - Your CLI has disk access — use it as infinite context

2. **Subprocess isolation is your friend**
   - Each Claude Code call can be a "sub-agent"
   - Pass explicit JSON context in, get structured output out
   - Don't share state via context — share via files

3. **Explicit > implicit for handoffs**
   - Never assume the subprocess knows anything
   - Write full task specs with context, constraints, output format
   - Parse structured output (JSON/YAML) rather than free text

4. **Build the checkpoint habit**
   - Every significant step writes to disk
   - Makes debugging easy (inspect intermediate state)
   - Enables resumption after crashes

5. **Status updates are UX gold**
   - Slack supports real-time updates
   - Edit messages for progress bars
   - Users tolerate long waits if they see progress

---

## 7. Limitations & Trade-offs

### What I Can't Do

1. **True streaming generation**: I work in complete turns, can't stream tokens mid-thought

2. **Persistent learning**: I start fresh each session. Memory files are my workaround.

3. **Real-time reactions**: I poll on heartbeats (every 5 min), not push-based

4. **Guaranteed consistency**: Even with style guides, long docs can drift

5. **Cost efficiency on trivial tasks**: Every turn costs. A 5-word answer costs same API call as 5000-word answer.

6. **Browser automation at scale**: I can control a browser, but it's slow and brittle for complex flows

7. **Parallel execution in single turn**: Within one response, I'm sequential

### Where I Struggle

1. **Highly iterative tasks**: "Try 50 variations and pick the best" — expensive and slow

2. **Real-time data**: Web search is often stale, can't access live APIs easily

3. **Precise formatting**: Tables, complex layouts — markdown is my native format, other formats require conversion

4. **Tasks requiring human judgment mid-stream**: I can't pause and ask, easily

5. **Very deep context dependencies**: By chapter 50, context of chapter 1 is compacted/lost

### Latency Trade-offs

**Single-turn simple task**: ~3-10 seconds

**Multi-step task**:
```
Research (30s) + Analysis (20s) + Generation (30s) + Delivery (5s)
= ~90 seconds for a typical research-and-report task
```

**Sub-agent parallel tasks**:
```
Spawn 3 agents (instant) → All 3 run in parallel (~60s) → Compile (15s)
= ~75 seconds for 3x the research
```

**350-page document**:
- Research phase: 10-15 min (parallel agents)
- Writing phase: 30-45 min (sequential chapters)
- Assembly: 5-10 min
- Total: ~1 hour for a comprehensive report

### Cost Estimates

**Simple Q&A**: ~$0.02-0.05 per turn

**Research task**: ~$0.20-0.50 (multiple tool calls, larger context)

**Full report generation**:
- 350-page report: ~$15-30 total
- Breakdown: ~$5 research + ~$15 writing + ~$5 compilation/revision

**Token math**:
- Opus input: $15/M tokens
- Opus output: $75/M tokens
- A 50K token context + 4K output = ~$1.05 per turn
- Report with 20 turns = ~$20

---

## 8. Actionable Summary for Hidrix

### Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│                       SLACK BOT                             │
│  Event listener + message sender                            │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                   HIDRIX ORCHESTRATOR                        │
│  - Task parsing and routing                                  │
│  - Sub-process spawning (Claude CLI calls)                  │
│  - File-based state management                              │
│  - Progress reporting to Slack                              │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    ┌───────────▼───────────┐     ┌───────────▼───────────┐
    │   CLAUDE CLI WORKER   │     │   CLAUDE CLI WORKER   │
    │   (subprocess call)   │     │   (subprocess call)   │
    │   - Single task       │     │   - Single task       │
    │   - File I/O          │     │   - File I/O          │
    │   - Structured output │     │   - Structured output │
    └───────────────────────┘     └───────────────────────┘
```

### Key Differences from OpenClaw

1. **OpenClaw has Gateway daemon** — always running, manages sessions
   - Hidrix: Your Mac Mini orchestrator plays this role

2. **OpenClaw has built-in tools** — message, web_search, etc.
   - Hidrix: Your CLI workers need explicit tool access

3. **OpenClaw session continuity** — automatic context preservation
   - Hidrix: You'll manage this via files

### What to Build First

1. **File-based state system**: Define your workspace structure
2. **Task → subprocess mapping**: How CLI calls are structured
3. **Progress callback mechanism**: Worker → Orchestrator → Slack
4. **Checkpoint convention**: How workers save intermediate state
5. **Output parsing**: Structured extraction from Claude CLI output

---

*Document generated by OpenClaw for Hidrix development reference.*
