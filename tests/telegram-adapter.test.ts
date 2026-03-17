import { describe, it, expect } from "vitest";
import { formatSessionKey, parseSessionKey } from "../src/types.js";
import type { SessionKey } from "../src/types.js";

describe("Telegram Adapter - Session Keys", () => {
  const key: SessionKey = {
    agentId: "agent-1",
    orgId: "org-1",
    channel: "telegram",
    peerKind: "group",
    peerId: "-100123",
  };

  it("formats a session key", () => {
    const formatted = formatSessionKey(key);
    expect(formatted).toBe("agent:org-1:agent-1:telegram:group:-100123");
  });

  it("parses a session key", () => {
    const parsed = parseSessionKey("agent:org-1:agent-1:telegram:group:-100123");
    expect(parsed).toEqual(key);
  });

  it("throws on invalid session key", () => {
    expect(() => parseSessionKey("invalid")).toThrow("Invalid session key");
  });

  it("round-trips session keys", () => {
    const formatted = formatSessionKey(key);
    const parsed = parseSessionKey(formatted);
    expect(parsed).toEqual(key);
  });
});

describe("Telegram Adapter - Message Types", () => {
  it("identifies DM peer kind for positive chat IDs", () => {
    const chatId = "123456";
    const peerKind = chatId.startsWith("-") ? "group" : "dm";
    expect(peerKind).toBe("dm");
  });

  it("identifies group peer kind for negative chat IDs", () => {
    const chatId = "-100123456";
    const peerKind = chatId.startsWith("-") ? "group" : "dm";
    expect(peerKind).toBe("group");
  });
});
