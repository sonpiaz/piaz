import type { LLMMessage } from "./providers/types.js";
import type { IncomingMessage, SessionKey } from "./types.js";

export interface SessionData {
  key: SessionKey;
  messages: LLMMessage[];
  summary?: string;
  tokenEstimate: number;
  createdAt: number;
  updatedAt: number;
}

export interface ContextEngine {
  ingest(session: SessionData, incoming: IncomingMessage): SessionData;
  assemble(session: SessionData, systemPrompt: string): LLMMessage[];
  compact(session: SessionData, summaryText: string): SessionData;
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === "string") {
      total += estimateTokens(m.content);
    } else {
      for (const block of m.content) {
        if (block.text) total += estimateTokens(block.text);
        if (block.content) total += estimateTokens(block.content);
        if (block.input) total += estimateTokens(JSON.stringify(block.input));
      }
    }
  }
  return total;
}

export function createContextEngine(): ContextEngine {
  return {
    ingest(session, incoming) {
      const userMessage: LLMMessage = {
        role: "user",
        content: incoming.text,
      };
      const messages = [...session.messages, userMessage];
      return {
        ...session,
        messages,
        tokenEstimate: estimateMessagesTokens(messages),
        updatedAt: Date.now(),
      };
    },

    assemble(session, systemPrompt) {
      const messages: LLMMessage[] = [];
      if (session.summary) {
        messages.push({
          role: "user",
          content: `[Previous conversation summary]\n${session.summary}`,
        });
        messages.push({
          role: "assistant",
          content: "Understood. I have the context from our previous conversation.",
        });
      }
      messages.push(...session.messages);
      return messages;
    },

    compact(session, summaryText) {
      const keepCount = 12;
      const kept = session.messages.slice(-keepCount);
      return {
        ...session,
        messages: kept,
        summary: summaryText,
        tokenEstimate: estimateMessagesTokens(kept) + estimateTokens(summaryText),
        updatedAt: Date.now(),
      };
    },
  };
}
