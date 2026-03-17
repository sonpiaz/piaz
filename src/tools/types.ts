import type { SessionKey } from "../types.js";

export interface ToolContext {
  sessionKey: SessionKey;
  orgId: string;
  chatId: string;
  userId: string;
  sendMessage: (text: string) => Promise<void>;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface ToolRegistry {
  register(tool: ToolDef): void;
  get(name: string): ToolDef | undefined;
  all(): ToolDef[];
  summaries(): Array<{ name: string; description: string }>;
  toLLMTools(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
}
