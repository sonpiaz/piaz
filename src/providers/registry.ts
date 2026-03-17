import type { LLMProvider } from "./types.js";

const providers = new Map<string, LLMProvider>();

export function registerProvider(provider: LLMProvider) {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): LLMProvider {
  const p = providers.get(name);
  if (!p) throw new Error(`Unknown LLM provider: ${name}. Registered: ${[...providers.keys()]}`);
  return p;
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
