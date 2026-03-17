import { describe, it, expect } from "vitest";
import { createToolRegistry } from "../src/tools/registry.js";
import type { ToolDef } from "../src/tools/types.js";

const mockTool: ToolDef = {
  name: "test_tool",
  description: "A test tool",
  input_schema: {
    type: "object",
    properties: { input: { type: "string" } },
    required: ["input"],
  },
  async execute(input) {
    return `echo: ${input.input}`;
  },
};

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = createToolRegistry();
    registry.register(mockTool);
    expect(registry.get("test_tool")).toBe(mockTool);
  });

  it("returns undefined for unknown tool", () => {
    const registry = createToolRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all tools", () => {
    const registry = createToolRegistry();
    registry.register(mockTool);
    expect(registry.all()).toHaveLength(1);
    expect(registry.all()[0].name).toBe("test_tool");
  });

  it("generates summaries", () => {
    const registry = createToolRegistry();
    registry.register(mockTool);
    const summaries = registry.summaries();
    expect(summaries).toEqual([
      { name: "test_tool", description: "A test tool" },
    ]);
  });

  it("generates LLM tool definitions", () => {
    const registry = createToolRegistry();
    registry.register(mockTool);
    const tools = registry.toLLMTools();
    expect(tools[0]).toHaveProperty("name", "test_tool");
    expect(tools[0]).toHaveProperty("input_schema");
  });

  it("executes a tool", async () => {
    const result = await mockTool.execute(
      { input: "hello" },
      {
        sessionKey: {
          agentId: "test",
          orgId: "org1",
          channel: "telegram",
          peerKind: "dm",
          peerId: "123",
        },
        orgId: "org1",
        chatId: "123",
        userId: "456",
        sendMessage: async () => {},
      },
    );
    expect(result).toBe("echo: hello");
  });
});
