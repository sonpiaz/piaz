import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage } from "../src/types.js";

// We test the dedup and rate-limit logic by importing the router module
// Since the router depends on DB, we mock the DB calls

vi.mock("../src/db/index.js", () => ({
  getDb: () => ({}),
}));

vi.mock("../src/db/queries.js", () => ({
  findOrgByTelegramChat: vi.fn().mockResolvedValue({
    id: "org-1",
    name: "Test Org",
    telegramChatIds: ["123"],
  }),
  findAgentForChat: vi.fn().mockResolvedValue({
    id: "agent-1",
    name: "Assistant",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    bindings: [{ type: "default" }],
  }),
  findOrCreateUser: vi.fn().mockResolvedValue({
    id: "user-1",
    telegramUserId: "456",
  }),
}));

function makeMessage(overrides?: Partial<IncomingMessage>): IncomingMessage {
  return {
    id: "1",
    channel: "telegram",
    chatId: "123",
    userId: "456",
    userName: "Test",
    text: "Hello " + Math.random(),
    raw: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("Router", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("routes a valid message", async () => {
    const { route } = await import("../src/gateway/router.js");
    const msg = makeMessage();
    const result = await route(msg);

    expect(result).not.toBeNull();
    expect(result!.sessionKey.orgId).toBe("org-1");
    expect(result!.sessionKey.agentId).toBe("agent-1");
    expect(result!.orgContext.orgName).toBe("Test Org");
  });

  it("deduplicates identical messages", async () => {
    const { route } = await import("../src/gateway/router.js");
    const msg = makeMessage({ text: "duplicate test" });

    const r1 = await route(msg);
    const r2 = await route(msg); // same msg object = same hash

    expect(r1).not.toBeNull();
    expect(r2).toBeNull(); // deduped
  });

  it("assigns group peer kind for negative chat IDs", async () => {
    const { route } = await import("../src/gateway/router.js");
    const msg = makeMessage({ chatId: "-100123456" });
    const result = await route(msg);

    expect(result!.sessionKey.peerKind).toBe("group");
  });

  it("assigns dm peer kind for positive chat IDs", async () => {
    const { route } = await import("../src/gateway/router.js");
    const msg = makeMessage({ chatId: "789" });
    const result = await route(msg);

    expect(result!.sessionKey.peerKind).toBe("dm");
  });
});
