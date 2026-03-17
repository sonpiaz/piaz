import type { LLMMessage, LLMContentBlock } from "./providers/types.js";
import type { SessionData } from "./context-engine.js";
import type { ToolRegistry } from "./tools/types.js";
import type { ChannelAdapter } from "./channels/types.js";
import type { SkillRegistry } from "./skills/registry.js";
import type { IncomingMessage, OrgContext, SessionKey } from "./types.js";
import { log } from "./types.js";
import { getProvider } from "./providers/registry.js";
import { createContextEngine } from "./context-engine.js";
import { loadSession, saveSession, needsCompaction } from "./sessions/manager.js";
import { compactSession } from "./sessions/compaction.js";
import { readR2 } from "./sessions/r2-writer.js";

const MAX_TOOL_ITERATIONS = 50;

interface WorkerInput {
  message: IncomingMessage;
  sessionKey: SessionKey;
  orgContext: OrgContext;
  toolRegistry: ToolRegistry;
  channel: ChannelAdapter;
  skillRegistry?: SkillRegistry;
}

export async function runWorker(input: WorkerInput): Promise<void> {
  const { message, sessionKey, orgContext, toolRegistry, channel, skillRegistry } = input;
  const contextEngine = createContextEngine();

  // Load session
  let session = await loadSession(sessionKey);

  // Ingest new message
  session = contextEngine.ingest(session, message);

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(orgContext, toolRegistry, skillRegistry);

  // Get provider
  const agent = orgContext; // simplified
  const providerName = "anthropic"; // default
  const model = "claude-sonnet-4-6";
  const provider = getProvider(providerName);

  // Check compaction
  if (needsCompaction(session)) {
    log("info", "Compacting session", { key: sessionKey });
    const summary = await compactSession(session.messages, provider, model);
    session = contextEngine.compact(session, summary);
  }

  // Assemble messages for LLM
  const messages = contextEngine.assemble(session, systemPrompt);
  const tools = toolRegistry.toLLMTools();

  // Tool loop
  let iterations = 0;
  let currentMessages = messages;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    let response;
    try {
      response = await provider.chat({
        model,
        system: systemPrompt,
        messages: currentMessages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 4096,
      });
    } catch (e) {
      const err = e as Error & { status?: number };
      // Transient errors: retry up to 2 times
      if (isTransient(err) && iterations <= 2) {
        log("warn", "Transient LLM error, retrying", { error: err.message, attempt: iterations });
        await new Promise((r) => setTimeout(r, 1000 * iterations));
        continue;
      }
      log("error", "Fatal LLM error", { error: err.message });
      await channel.sendMessage(message.chatId, {
        text: "Sorry, I encountered an error. Please try again.",
      });
      return;
    }

    // Collect text blocks and tool use blocks
    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    // If no tool calls, send final response
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      const replyText = textBlocks.map((b) => b.text ?? "").join("\n");
      if (replyText.trim()) {
        await channel.sendMessage(message.chatId, {
          text: replyText,
          parseMode: "HTML",
        });
      }

      // Append assistant response to session
      session.messages.push({ role: "assistant", content: replyText });
      session.updatedAt = Date.now();
      break;
    }

    // Append assistant response with tool calls
    const assistantMessage: LLMMessage = {
      role: "assistant",
      content: response.content,
    };
    currentMessages.push(assistantMessage);
    session.messages.push(assistantMessage);

    // Send any intermediate text
    const intermediateText = textBlocks.map((b) => b.text ?? "").join("\n");
    if (intermediateText.trim()) {
      await channel.sendMessage(message.chatId, {
        text: intermediateText,
        parseMode: "HTML",
      });
    }

    // Execute tool calls
    const toolResults: LLMContentBlock[] = [];
    for (const tc of toolUseBlocks) {
      const tool = toolRegistry.get(tc.name!);
      let result: string;

      if (!tool) {
        result = `Error: Unknown tool "${tc.name}"`;
      } else {
        try {
          result = await tool.execute(tc.input ?? {}, {
            sessionKey,
            orgId: orgContext.orgId,
            chatId: message.chatId,
            userId: message.userId,
            sendMessage: (text) =>
              channel.sendMessage(message.chatId, { text }),
          });
        } catch (e) {
          result = `Error: ${(e as Error).message}`;
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tc.id!,
        content: result,
      });
    }

    // Append tool results
    const toolResultMessage: LLMMessage = {
      role: "user",
      content: toolResults,
    };
    currentMessages.push(toolResultMessage);
    session.messages.push(toolResultMessage);
  }

  if (iterations >= MAX_TOOL_ITERATIONS) {
    log("warn", "Tool loop hit max iterations", { key: sessionKey });
    await channel.sendMessage(message.chatId, {
      text: "I've reached my processing limit for this request.",
    });
  }

  // Save session
  await saveSession(session);
}

async function buildSystemPrompt(
  org: OrgContext,
  tools: ToolRegistry,
  skills?: SkillRegistry,
): Promise<string> {
  const parts: string[] = [];

  // SOUL
  const soul = org.systemPromptFiles.soul
    ? await readR2(org.systemPromptFiles.soul)
    : null;
  parts.push(`<soul>\n${soul ?? DEFAULT_SOUL}\n</soul>`);

  // AGENTS
  const agents = org.systemPromptFiles.agents
    ? await readR2(org.systemPromptFiles.agents)
    : null;
  if (agents) parts.push(`<agents>\n${agents}\n</agents>`);

  // MEMORY
  const memory = org.systemPromptFiles.memory
    ? await readR2(org.systemPromptFiles.memory)
    : null;
  if (memory) parts.push(`<memory>\n${memory}\n</memory>`);

  // Runtime
  parts.push(
    `<runtime>\ndate: ${new Date().toISOString()}\norg: ${org.orgName}\nagent: ${org.agentName}\n</runtime>`,
  );

  // Tool summaries
  const summaries = tools.summaries();
  if (summaries.length > 0) {
    const list = summaries.map((s) => `- ${s.name}: ${s.description}`).join("\n");
    parts.push(`<available_tools>\n${list}\n</available_tools>`);
  }

  // Skill summaries (lazy — only names + descriptions in prompt)
  if (skills) {
    const skillList = skills.summaries();
    if (skillList) {
      parts.push(`<available_skills>\n${skillList}\n</available_skills>`);
    }
  }

  return parts.join("\n\n");
}

const DEFAULT_SOUL = `You are a helpful AI assistant. Be concise, accurate, and friendly.
If you're unsure about something, say so. Use the tools available to you when needed.`;

function isTransient(err: Error & { status?: number }): boolean {
  if (err.status === 429) return true; // rate limit
  if (err.status === 500) return true; // server error
  if (err.status === 503) return true; // service unavailable
  if (err.message.includes("ECONNRESET")) return true;
  if (err.message.includes("ETIMEDOUT")) return true;
  return false;
}
