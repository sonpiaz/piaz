import { describe, it, expect, vi } from "vitest";
import type { SessionData } from "../src/context-engine.js";
import type { SessionKey } from "../src/types.js";

// Mock R2 and DB
vi.mock("../src/sessions/r2-writer.js", () => ({
  readR2: vi.fn().mockResolvedValue(null),
  writeR2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/db/index.js", () => ({
  getDb: () => ({}),
}));

vi.mock("../src/db/queries.js", () => ({
  findSession: vi.fn().mockResolvedValue(null),
  upsertSession: vi.fn().mockResolvedValue({}),
}));

describe("Session Manager", () => {
  const testKey: SessionKey = {
    agentId: "agent-1",
    orgId: "org-1",
    channel: "telegram",
    peerKind: "dm",
    peerId: "123",
  };

  it("loads an empty session when none exists", async () => {
    const { loadSession } = await import("../src/sessions/manager.js");
    const session = await loadSession(testKey);

    expect(session.key).toEqual(testKey);
    expect(session.messages).toEqual([]);
    expect(session.tokenEstimate).toBe(0);
  });

  it("detects compaction need at high token count", async () => {
    const { needsCompaction } = await import("../src/sessions/manager.js");
    const session: SessionData = {
      key: testKey,
      messages: [],
      tokenEstimate: 200_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(needsCompaction(session)).toBe(true);
  });

  it("does not need compaction at low token count", async () => {
    const { needsCompaction } = await import("../src/sessions/manager.js");
    const session: SessionData = {
      key: testKey,
      messages: [],
      tokenEstimate: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(needsCompaction(session)).toBe(false);
  });
});
