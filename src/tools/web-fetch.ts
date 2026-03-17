import type { ToolDef } from "./types.js";

const tool: ToolDef = {
  name: "web_fetch",
  description: "Fetch a URL and return its text content. Useful for reading web pages or APIs.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      method: {
        type: "string",
        description: "HTTP method (GET, POST)",
        default: "GET",
      },
    },
    required: ["url"],
  },

  async execute(input) {
    const url = input.url as string;
    const method = (input.method as string) ?? "GET";

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return "Error: Invalid URL";
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const resp = await fetch(url, {
        method,
        signal: controller.signal,
        headers: { "User-Agent": "Piaz/0.1" },
      });

      clearTimeout(timeout);

      const text = await resp.text();
      if (text.length > 50_000) {
        return text.slice(0, 50_000) + "\n\n[Truncated — response exceeds 50KB]";
      }
      return text;
    } catch (e) {
      return `Error fetching URL: ${(e as Error).message}`;
    }
  },
};

export default tool;
