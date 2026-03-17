import type { LLMProvider, LLMMessage } from "../providers/types.js";

const COMPACTION_PROMPT = `Summarize the conversation so far in a concise paragraph.
Focus on: key decisions, important facts mentioned, the user's goals, and any pending tasks.
Keep it under 500 words. Write in third person.`;

export async function compactSession(
  messages: LLMMessage[],
  provider: LLMProvider,
  model: string,
): Promise<string> {
  const transcript = messages
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n");
      return `${role}: ${text}`;
    })
    .join("\n\n");

  const resp = await provider.chat({
    model,
    system: COMPACTION_PROMPT,
    messages: [{ role: "user", content: transcript }],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const text = resp.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Compaction returned no text");
  return text;
}
