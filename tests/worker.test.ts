import { describe, it, expect, vi } from "vitest";
import { createContextEngine } from "../src/context-engine.js";
import type { SessionData } from "../src/context-engine.js";
import type { SessionKey, IncomingMessage } from "../src/types.js";

describe("ContextEngine", () => {
  const testKey: SessionKey = {
    agentId: "agent-1",
    orgId: "org-1",
    channel: "telegram",
    peerKind: "dm",
    peerId: "123",
  };

  const emptySession: SessionData = {
    key: testKey,
    messages: [],
    tokenEstimate: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const engine = createContextEngine();

  it("ingests a message into the session", () => {
    const msg: IncomingMessage = {
      id: "1",
      channel: "telegram",
      chatId: "123",
      userId: "456",
      userName: "Test",
      text: "Hello world",
      raw: {},
      timestamp: Date.now(),
      isDirected: true,
    };

    const result = engine.ingest(emptySession, msg);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello world");
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("assembles messages with summary", () => {
    const session: SessionData = {
      ...emptySession,
      messages: [{ role: "user", content: "What's the weather?" }],
      summary: "User previously asked about project status.",
    };

    const assembled = engine.assemble(session, "You are helpful.");
    // Summary + ack + actual message
    expect(assembled).toHaveLength(3);
    expect(assembled[0].content).toContain("Previous conversation summary");
  });

  it("compacts by keeping last 12 messages", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));

    const session: SessionData = {
      ...emptySession,
      messages,
      tokenEstimate: 200_000,
    };

    const compacted = engine.compact(session, "Summary of earlier conversation.");
    expect(compacted.messages).toHaveLength(12);
    expect(compacted.summary).toBe("Summary of earlier conversation.");
    expect(compacted.messages[0].content).toBe("Message 8");
  });
});
