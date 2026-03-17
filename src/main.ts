import { createTelegramAdapter } from "./channels/telegram.js";
import { createGateway } from "./gateway/index.js";
import { createToolRegistry, registerBuiltinTools } from "./tools/registry.js";
import { registerProvider } from "./providers/registry.js";
import { createAnthropicProvider } from "./providers/anthropic.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createOllamaProvider } from "./providers/ollama.js";
import { handleStartCommand, handleGroupAdd } from "./onboarding.js";
import { startDrainLoop, stopDrainLoop, drainBuffer } from "./sessions/local-buffer.js";
import { config } from "./config.js";
import { log } from "./types.js";

async function main() {
  log("info", "Starting Piaz v0.1", { env: config.app.nodeEnv() });

  // Register LLM providers
  registerProvider(createAnthropicProvider());
  try {
    if (config.llm.openaiApiKey()) registerProvider(createOpenAIProvider());
  } catch {
    log("info", "OpenAI provider not configured, skipping");
  }
  registerProvider(createOllamaProvider());

  // Set up tools
  const toolRegistry = createToolRegistry();
  registerBuiltinTools(toolRegistry);

  // Set up Telegram
  const telegram = createTelegramAdapter();

  // Handle /start command for onboarding
  const originalOnMessage = telegram.onMessage.bind(telegram);
  let gatewayHandler: ((msg: import("./types.js").IncomingMessage) => Promise<void>) | null = null;

  telegram.onMessage = (handler) => {
    gatewayHandler = handler;
    originalOnMessage(async (msg) => {
      // /start command
      if (msg.text.trim() === "/start") {
        await handleStartCommand(msg.chatId, msg.userId, msg.userName, telegram);
        return;
      }
      await handler(msg);
    });
  };

  // Create and start gateway
  const gateway = createGateway({
    channel: telegram,
    toolRegistry,
    botUserId: telegram.botUserId,
  });

  gateway.start();
  await telegram.start();

  // Start R2 buffer drain loop (retries failed writes every 30s)
  startDrainLoop();
  drainBuffer().catch(() => {}); // Drain any leftover from previous run

  log("info", "Piaz is running");

  // Graceful shutdown
  const shutdown = async () => {
    log("info", "Shutting down...");
    stopDrainLoop();
    await telegram.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log("error", "Fatal startup error", { error: (e as Error).message, stack: (e as Error).stack });
  process.exit(1);
});
