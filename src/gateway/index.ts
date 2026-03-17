import type { IncomingMessage } from "../types.js";
import type { ChannelAdapter } from "../channels/types.js";
import type { ToolRegistry } from "../tools/types.js";
import type { SkillRegistry } from "../skills/registry.js";
import { log } from "../types.js";
import { route } from "./router.js";
import { spawnWorker } from "./worker-spawner.js";

export interface GatewayOptions {
  channel: ChannelAdapter;
  toolRegistry: ToolRegistry;
  skillRegistry?: SkillRegistry;
  botUserId?: string;
}

export function createGateway(opts: GatewayOptions) {
  const { channel, toolRegistry, skillRegistry, botUserId } = opts;

  async function handleMessage(msg: IncomingMessage): Promise<void> {
    // Echo guard: ignore bot's own messages
    if (botUserId && msg.userId === botUserId) return;

    // Skip empty messages
    if (!msg.text?.trim()) return;

    // In groups, only respond to directed messages (@mention, reply, /command)
    if (!msg.isDirected) return;

    log("info", "Incoming message", {
      chatId: msg.chatId,
      userId: msg.userId,
      text: msg.text.slice(0, 100),
    });

    // Route
    const result = await route(msg);
    if (!result) return;

    // Spawn worker (handles locking + queuing)
    await spawnWorker(
      msg,
      result.sessionKey,
      result.orgContext,
      toolRegistry,
      channel,
      skillRegistry,
    );
  }

  return {
    start() {
      channel.onMessage(handleMessage);
      log("info", "Gateway started");
    },
  };
}
