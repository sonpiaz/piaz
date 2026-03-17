import type { ChannelAdapter } from "./channels/types.js";
import type { IncomingMessage } from "./types.js";
import { getDb } from "./db/index.js";
import { findOrgByTelegramChat } from "./db/queries.js";

const HELP_TEXT = `<b>Piaz — AI Agent Platform</b>

<b>Commands:</b>
/start — Set up this chat with Piaz
/help — Show this help message
/settings — View workspace settings
/brain — Upload documents to the knowledge base
/status — Check bot status

<b>In groups:</b>
• @mention me or reply to my messages
• I won't respond to every message — only when directed

<b>In DMs:</b>
• Just send me a message — no @mention needed`;

export async function handleCommand(
  msg: IncomingMessage,
  channel: ChannelAdapter,
): Promise<boolean> {
  const cmd = msg.text.trim().split(/\s/)[0].toLowerCase();

  switch (cmd) {
    case "/help":
      await channel.sendMessage(msg.chatId, { text: HELP_TEXT, parseMode: "HTML" });
      return true;

    case "/settings": {
      const db = getDb();
      const org = await findOrgByTelegramChat(db, msg.chatId);
      if (!org) {
        await channel.sendMessage(msg.chatId, {
          text: "This chat isn't connected to a workspace yet. Use /start first.",
        });
        return true;
      }

      const settings = [
        `<b>Workspace Settings</b>`,
        ``,
        `Organization: ${org.name}`,
        `Org ID: <code>${org.id}</code>`,
        `Connected chats: ${(org.telegramChatIds as string[])?.length ?? 0}`,
      ].join("\n");

      await channel.sendMessage(msg.chatId, { text: settings, parseMode: "HTML" });
      return true;
    }

    case "/status":
      await channel.sendMessage(msg.chatId, {
        text: [
          `<b>Piaz Status</b>`,
          ``,
          `Version: 0.1.0`,
          `Uptime: ${formatUptime(process.uptime())}`,
          `Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        ].join("\n"),
        parseMode: "HTML",
      });
      return true;

    default:
      return false;
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
