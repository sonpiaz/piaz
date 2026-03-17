function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing env: ${key}`);
  return val;
}

export const config = {
  telegram: {
    botToken: () => env("TELEGRAM_BOT_TOKEN"),
  },
  llm: {
    anthropicApiKey: () => env("ANTHROPIC_API_KEY"),
    openaiApiKey: () => env("OPENAI_API_KEY", ""),
    ollamaBaseUrl: () => env("OLLAMA_BASE_URL", "http://localhost:11434"),
    defaultProvider: "anthropic" as const,
    defaultModel: "claude-sonnet-4-6",
  },
  db: {
    url: () => env("DATABASE_URL"),
  },
  r2: {
    accountId: () => env("R2_ACCOUNT_ID"),
    accessKeyId: () => env("R2_ACCESS_KEY_ID"),
    secretAccessKey: () => env("R2_SECRET_ACCESS_KEY"),
    bucket: () => env("R2_BUCKET_NAME", "piaz-sessions"),
    endpoint: () => env("R2_ENDPOINT"),
  },
  app: {
    nodeEnv: () => env("NODE_ENV", "development"),
    logLevel: () => env("LOG_LEVEL", "info"),
    port: () => parseInt(env("PORT", "3000"), 10),
  },
} as const;
