import { getDb } from "./db/index.js";
import { createOrg, createAgent, findOrgByTelegramChat } from "./db/queries.js";
import { writeR2 } from "./sessions/r2-writer.js";
import { log } from "./types.js";
import type { ChannelAdapter } from "./channels/types.js";

const DEFAULT_SOUL = `You are a helpful AI assistant for this organization.
Be concise, accurate, and professional. Use the tools available to help users.
Always be truthful — if you don't know something, say so.`;

const DEFAULT_AGENTS = `# Agents

## Default Agent
- Name: Assistant
- Role: General-purpose assistant
- Skills: read_file, write_file, web_fetch, memory_search`;

export async function handleStartCommand(
  chatId: string,
  userId: string,
  userName: string,
  channel: ChannelAdapter,
): Promise<void> {
  const db = getDb();

  // Check if org already exists for this chat
  const existing = await findOrgByTelegramChat(db, chatId);
  if (existing) {
    await channel.sendMessage(chatId, {
      text: `This chat is already connected to organization "${existing.name}".`,
    });
    return;
  }

  // Create org
  const orgName = `Org-${chatId.replace("-", "")}`;
  const org = await createOrg(db, orgName, [chatId]);

  // Create default agent
  const agent = await createAgent(db, org.id, "Assistant");

  // Initialize workspace files on R2
  const soulPath = `workspaces/${org.id}/SOUL.md`;
  const agentsPath = `workspaces/${org.id}/AGENTS.md`;
  const memoryPath = `workspaces/${org.id}/MEMORY.md`;

  await Promise.all([
    writeR2(soulPath, DEFAULT_SOUL),
    writeR2(agentsPath, DEFAULT_AGENTS),
    writeR2(memoryPath, "# Memory\n\nNo memories yet."),
  ]);

  log("info", "New org onboarded", {
    orgId: org.id,
    chatId,
    agentId: agent.id,
  });

  await channel.sendMessage(chatId, {
    text: [
      `Welcome to Piaz! Your workspace has been created.`,
      ``,
      `Organization: ${orgName}`,
      `Agent: ${agent.name}`,
      ``,
      `I'm ready to help. Just send me a message!`,
    ].join("\n"),
  });
}

export async function handleGroupAdd(
  chatId: string,
  chatTitle: string,
  channel: ChannelAdapter,
): Promise<void> {
  const db = getDb();
  const existing = await findOrgByTelegramChat(db, chatId);

  if (existing) {
    log("info", "Bot added to already-known group", { chatId, orgId: existing.id });
    return;
  }

  // Auto-create org for group
  const org = await createOrg(db, chatTitle || `Group-${chatId}`, [chatId]);
  const agent = await createAgent(db, org.id, "Assistant");

  const soulPath = `workspaces/${org.id}/SOUL.md`;
  const agentsPath = `workspaces/${org.id}/AGENTS.md`;
  const memoryPath = `workspaces/${org.id}/MEMORY.md`;

  await Promise.all([
    writeR2(soulPath, DEFAULT_SOUL),
    writeR2(agentsPath, DEFAULT_AGENTS),
    writeR2(memoryPath, "# Memory\n\nNo memories yet."),
  ]);

  log("info", "Group auto-onboarded", { orgId: org.id, chatId, chatTitle });

  await channel.sendMessage(chatId, {
    text: `Hello! I've set up a workspace for this group. Send me a message to get started!`,
  });
}
