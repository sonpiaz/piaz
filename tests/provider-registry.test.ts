import { describe, it, expect, beforeEach } from "vitest";

describe("Provider Registry", () => {
  beforeEach(async () => {
    // Reset module state between tests
    const { vi } = await import("vitest");
    vi.resetModules();
  });

  it("registers and retrieves a provider", async () => {
    const { registerProvider, getProvider } = await import(
      "../src/providers/registry.js"
    );

    const mockProvider = {
      name: "test",
      chat: async () => ({
        content: [{ type: "text" as const, text: "hi" }],
        model: "test",
        usage: { input_tokens: 0, output_tokens: 0 },
        stop_reason: "end_turn" as const,
      }),
    };

    registerProvider(mockProvider);
    expect(getProvider("test")).toBe(mockProvider);
  });

  it("throws for unknown provider", async () => {
    const { getProvider } = await import("../src/providers/registry.js");
    expect(() => getProvider("nonexistent")).toThrow("Unknown LLM provider");
  });

  it("lists registered providers", async () => {
    const { registerProvider, listProviders } = await import(
      "../src/providers/registry.js"
    );

    registerProvider({
      name: "p1",
      chat: async () => ({
        content: [],
        model: "p1",
        usage: { input_tokens: 0, output_tokens: 0 },
        stop_reason: "end_turn",
      }),
    });

    expect(listProviders()).toContain("p1");
  });
});
