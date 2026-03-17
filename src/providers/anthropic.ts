import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { LLMProvider, LLMRequest, LLMResponse, LLMContentBlock } from "./types.js";

export function createAnthropicProvider(): LLMProvider {
  let client: Anthropic | null = null;

  function getClient() {
    if (!client) client = new Anthropic({ apiKey: config.llm.anthropicApiKey() });
    return client;
  }

  return {
    name: "anthropic",

    async chat(request: LLMRequest): Promise<LLMResponse> {
      const messages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : m.content.map(toAnthropicBlock),
        }));

      const params: Anthropic.MessageCreateParams = {
        model: request.model,
        max_tokens: request.max_tokens ?? 4096,
        system: request.system,
        messages,
      };

      if (request.tools?.length) {
        params.tools = request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        }));
      }

      if (request.temperature !== undefined) {
        params.temperature = request.temperature;
      }

      const resp = await getClient().messages.create(params);

      return {
        content: resp.content.map(fromAnthropicBlock),
        model: resp.model,
        usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens },
        stop_reason: resp.stop_reason ?? "end_turn",
      };
    },
  };
}

function toAnthropicBlock(block: LLMContentBlock): Anthropic.ContentBlockParam {
  if (block.type === "text") return { type: "text", text: block.text! };
  if (block.type === "tool_use")
    return { type: "tool_use", id: block.id!, name: block.name!, input: block.input ?? {} };
  if (block.type === "tool_result")
    return {
      type: "tool_result",
      tool_use_id: block.tool_use_id!,
      content: block.content ?? "",
      is_error: block.is_error,
    };
  return { type: "text", text: "" };
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): LLMContentBlock {
  if (block.type === "text") return { type: "text", text: block.text };
  if (block.type === "tool_use")
    return {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: block.input as Record<string, unknown>,
    };
  return { type: "text", text: "" };
}
