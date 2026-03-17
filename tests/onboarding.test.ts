import { describe, it, expect, vi } from "vitest";

vi.mock("../src/db/index.js", () => ({
  getDb: () => ({}),
}));

vi.mock("../src/db/queries.js", () => ({
  findOrgByTelegramChat: vi.fn().mockResolvedValue(null),
  createOrg: vi.fn().mockResolvedValue({ id: "org-new", name: "Test Org" }),
  createAgent: vi.fn().mockResolvedValue({ id: "agent-new", name: "Assistant" }),
}));

vi.mock("../src/sessions/r2-writer.js", () => ({
  writeR2: vi.fn().mockResolvedValue(undefined),
}));

describe("Onboarding", () => {
  it("creates org and agent on /start", async () => {
    const { handleStartCommand } = await import("../src/onboarding.js");
    const { createOrg, createAgent } = await import("../src/db/queries.js");
    const { writeR2 } = await import("../src/sessions/r2-writer.js");

    const sentMessages: string[] = [];
    const mockChannel = {
      name: "telegram",
      start: vi.fn(),
      stop: vi.fn(),
      onMessage: vi.fn(),
      sendMessage: vi.fn(async (_: string, msg: { text: string }) => {
        sentMessages.push(msg.text);
      }),
      getFileUrl: vi.fn(),
    };

    await handleStartCommand("123", "456", "TestUser", mockChannel);

    expect(createOrg).toHaveBeenCalled();
    expect(createAgent).toHaveBeenCalled();
    expect(writeR2).toHaveBeenCalledTimes(3); // SOUL, AGENTS, MEMORY
    expect(sentMessages[0]).toContain("Welcome to Piaz");
  });

  it("rejects duplicate /start", async () => {
    const queries = await import("../src/db/queries.js");
    vi.mocked(queries.findOrgByTelegramChat).mockResolvedValueOnce({
      id: "org-existing",
      name: "Existing Org",
      telegramChatIds: ["123"],
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { handleStartCommand } = await import("../src/onboarding.js");

    const sentMessages: string[] = [];
    const mockChannel = {
      name: "telegram",
      start: vi.fn(),
      stop: vi.fn(),
      onMessage: vi.fn(),
      sendMessage: vi.fn(async (_: string, msg: { text: string }) => {
        sentMessages.push(msg.text);
      }),
      getFileUrl: vi.fn(),
    };

    await handleStartCommand("123", "456", "TestUser", mockChannel);
    expect(sentMessages[0]).toContain("already connected");
  });
});
