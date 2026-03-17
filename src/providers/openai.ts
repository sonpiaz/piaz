import OpenAI from "openai";
import { config } from "../config.js";
import type { LLMProvider, LLMRequest, LLMResponse, LLMContentBlock } from "./types.js";
import { randomUUID } from "node:crypto";

export function createOpenAIProvider(): LLMProvider {
  let client: OpenAI | null = null;

  function getClient() {
    if (!client) client = new OpenAI({ apiKey: config.llm.openaiApiKey() });
    return client;
  }

  return {
    name: "openai",

    async chat(request: LLMRequest): Promise<LLMResponse> {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: request.system },
        ...request.messages.map(toLLMMsg),
      ];

      const params: OpenAI.ChatCompletionCreateParams = {
        model: request.model,
        messages,
        max_tokens: request.max_tokens ?? 4096,
      };

      if (request.tools?.length) {
        params.tools = request.tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        }));
      }

      if (request.temperature !== undefined) {
        params.temperature = request.temperature;
      }

      const resp = await getClient().chat.completions.create(params);
      const choice = resp.choices[0];
      const content: LLMContentBlock[] = [];

      if (choice.message.content) {
        content.push({ type: "text", text: choice.message.content });
      }

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      const stopReason = choice.message.tool_calls?.length ? "tool_use" : "end_turn";

      return {
        content,
        model: resp.model,
        usage: {
          input_tokens: resp.usage?.prompt_tokens ?? 0,
          output_tokens: resp.usage?.completion_tokens ?? 0,
        },
        stop_reason: stopReason,
      };
    },
  };
}

function toLLMMsg(m: { role: string; content: string | LLMContentBlock[] }): OpenAI.ChatCompletionMessageParam {
  if (typeof m.content === "string") {
    return { role: m.role as "user" | "assistant", content: m.content };
  }
  // For tool results, convert back to OpenAI format
  const textParts = m.content.filter((b) => b.type === "text").map((b) => b.text ?? "");
  const toolResults = m.content.filter((b) => b.type === "tool_result");

  if (toolResults.length > 0) {
    // Return as tool message for the first tool result
    const tr = toolResults[0];
    return {
      role: "tool",
      tool_call_id: tr.tool_use_id!,
      content: tr.content ?? "",
    };
  }

  return {
    role: m.role as "user" | "assistant",
    content: textParts.join("\n"),
  };
}
