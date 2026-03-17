import { Bot, type Context } from "grammy";
import type { ChannelAdapter } from "./types.js";
import type { IncomingMessage, OutgoingMessage, MediaAttachment } from "../types.js";
import { log } from "../types.js";
import { config } from "../config.js";

export function createTelegramAdapter(): ChannelAdapter & { botUserId: string; botUsername: string } {
  const bot = new Bot(config.telegram.botToken());
  let messageHandler: ((msg: IncomingMessage) => Promise<void>) | null = null;
  let botUserId = "";
  let botUsername = "";

  return {
    name: "telegram",

    get botUserId() {
      return botUserId;
    },

    get botUsername() {
      return botUsername;
    },

    async start() {
      const me = await bot.api.getMe();
      botUserId = String(me.id);
      botUsername = me.username ?? "";
      log("info", "Telegram bot started", { username: me.username, id: me.id });

      bot.on("message", async (ctx: Context) => {
        if (!messageHandler || !ctx.message) return;

        const msg = normalize(ctx, botUsername, botUserId);
        if (msg) {
          try {
            await messageHandler(msg);
          } catch (e) {
            log("error", "Message handler error", { error: (e as Error).message });
          }
        }
      });

      // Auto-reconnect
      bot.catch((err) => {
        log("error", "Grammy error", { error: err.message });
      });

      bot.start({
        drop_pending_updates: true,
        onStart: () => log("info", "Telegram long-polling started"),
      });
    },

    async stop() {
      await bot.stop();
      log("info", "Telegram bot stopped");
    },

    onMessage(handler) {
      messageHandler = handler;
    },

    async sendMessage(chatId: string, msg: OutgoingMessage) {
      try {
        await bot.api.sendMessage(chatId, msg.text, {
          parse_mode: msg.parseMode === "HTML" ? "HTML" : undefined,
          reply_parameters: msg.replyToMessageId
            ? { message_id: parseInt(msg.replyToMessageId, 10) }
            : undefined,
        });
      } catch (e) {
        log("error", "Failed to send Telegram message", {
          chatId,
          error: (e as Error).message,
        });
        // Retry without parse mode in case of formatting error
        if (msg.parseMode) {
          try {
            await bot.api.sendMessage(chatId, msg.text);
          } catch {
            // Give up
          }
        }
      }
    },

    async getFileUrl(fileId: string): Promise<string> {
      const file = await bot.api.getFile(fileId);
      return `https://api.telegram.org/file/bot${config.telegram.botToken()}/${file.file_path}`;
    },
  };
}

function normalize(ctx: Context, botUsername: string, botUserId: string): IncomingMessage | null {
  const msg = ctx.message;
  if (!msg) return null;

  let text = msg.text ?? msg.caption ?? "";
  if (!text && !msg.photo && !msg.document) return null;

  const isDM = msg.chat.type === "private";
  const isCommand = text.startsWith("/");
  const isReplyToBot =
    msg.reply_to_message?.from?.id === Number(botUserId);

  // Check @mention in entities
  const hasMention =
    botUsername &&
    msg.entities?.some(
      (e) =>
        e.type === "mention" &&
        text
          .slice(e.offset, e.offset + e.length)
          .toLowerCase() === `@${botUsername.toLowerCase()}`,
    );

  // Strip @botUsername from text for cleaner processing
  if (hasMention && botUsername) {
    text = text.replace(new RegExp(`@${botUsername}\\b`, "gi"), "").trim();
  }

  const isDirected = isDM || isCommand || isReplyToBot || !!hasMention;

  const media: MediaAttachment[] = [];

  if (msg.photo) {
    const largest = msg.photo[msg.photo.length - 1];
    media.push({
      type: "photo",
      fileId: largest.file_id,
    });
  }

  if (msg.document) {
    media.push({
      type: "document",
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? undefined,
      mimeType: msg.document.mime_type ?? undefined,
    });
  }

  return {
    id: String(msg.message_id),
    channel: "telegram",
    chatId: String(msg.chat.id),
    userId: String(msg.from?.id ?? 0),
    userName: msg.from?.first_name ?? "Unknown",
    text,
    replyToMessageId: msg.reply_to_message
      ? String(msg.reply_to_message.message_id)
      : undefined,
    media: media.length > 0 ? media : undefined,
    raw: msg,
    timestamp: msg.date * 1000,
    isDirected,
  };
}
