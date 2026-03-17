import type { ToolDef, ToolRegistry } from "./types.js";

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDef>();

  return {
    register(tool) {
      tools.set(tool.name, tool);
    },

    get(name) {
      return tools.get(name);
    },

    all() {
      return [...tools.values()];
    },

    summaries() {
      return [...tools.values()].map((t) => ({
        name: t.name,
        description: t.description,
      }));
    },

    toLLMTools() {
      return [...tools.values()].map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    },
  };
}

export function registerBuiltinTools(registry: ToolRegistry) {
  // Lazy imports to avoid circular deps
  const modules = [
    () => import("./read.js"),
    () => import("./write.js"),
    () => import("./web-fetch.js"),
    () => import("./memory-search.js"),
  ];

  for (const load of modules) {
    load().then((m) => registry.register(m.default));
  }
}
