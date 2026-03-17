import type { IncomingMessage, OrgContext, SessionKey } from "../types.js";
import type { ToolRegistry } from "../tools/types.js";
import type { ChannelAdapter } from "../channels/types.js";
import { formatSessionKey, log } from "../types.js";
import { runWorker } from "../worker.js";

// Session locks: ensures only one worker per session at a time
const sessionLocks = new Map<string, Promise<void>>();

// Message queues: buffer messages that arrive while a session is locked
const messageQueues = new Map<string, Array<() => Promise<void>>>();

export async function spawnWorker(
  message: IncomingMessage,
  sessionKey: SessionKey,
  orgContext: OrgContext,
  toolRegistry: ToolRegistry,
  channel: ChannelAdapter,
): Promise<void> {
  const key = formatSessionKey(sessionKey);

  const task = async () => {
    try {
      await runWorker({ message, sessionKey, orgContext, toolRegistry, channel });
    } catch (e) {
      log("error", "Worker failed", { key, error: (e as Error).message });
      try {
        await channel.sendMessage(message.chatId, {
          text: "Sorry, something went wrong. Please try again.",
        });
      } catch {
        // Ignore send errors
      }
    }
  };

  // If session is locked, queue the message
  const existingLock = sessionLocks.get(key);
  if (existingLock) {
    log("debug", "Session locked, queuing message", { key });
    let queue = messageQueues.get(key);
    if (!queue) {
      queue = [];
      messageQueues.set(key, queue);
    }
    queue.push(task);
    return;
  }

  // Acquire lock and run
  await runWithLock(key, task);
}

async function runWithLock(key: string, task: () => Promise<void>): Promise<void> {
  const promise = (async () => {
    await task();

    // Process queued messages sequentially
    while (true) {
      const queue = messageQueues.get(key);
      if (!queue || queue.length === 0) {
        messageQueues.delete(key);
        break;
      }
      const next = queue.shift()!;
      await next();
    }
  })();

  sessionLocks.set(key, promise);

  try {
    await promise;
  } finally {
    sessionLocks.delete(key);
  }
}
