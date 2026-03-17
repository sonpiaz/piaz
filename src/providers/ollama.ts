import { config } from "../config.js";
import type { LLMProvider, LLMRequest, LLMResponse, LLMContentBlock } from "./types.js";

export function createOllamaProvider(): LLMProvider {
  return {
    name: "ollama",

    async chat(request: LLMRequest): Promise<LLMResponse> {
      const baseUrl = config.llm.ollamaBaseUrl();
      const messages = [
        { role: "system", content: request.system },
        ...request.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.map((b) => b.text ?? "").join("\n"),
        })),
      ];

      const resp = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.max_tokens ?? 4096,
          },
        }),
      });

      if (!resp.ok) {
        throw new Error(`Ollama error: ${resp.status} ${await resp.text()}`);
      }

      const data = (await resp.json()) as {
        message: { content: string };
        model: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: [{ type: "text", text: data.message.content }],
        model: data.model,
        usage: {
          input_tokens: data.prompt_eval_count ?? 0,
          output_tokens: data.eval_count ?? 0,
        },
        stop_reason: "end_turn",
      };
    },
  };
}
