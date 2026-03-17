import { readFile } from "node:fs/promises";
import type { ToolDef } from "./types.js";

const tool: ToolDef = {
  name: "read_file",
  description: "Read a file from the workspace. Returns the file content as text.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path to the file within the workspace",
      },
    },
    required: ["path"],
  },

  async execute(input) {
    const path = input.path as string;
    // Prevent path traversal
    if (path.includes("..") || path.startsWith("/")) {
      return "Error: Path traversal not allowed. Use relative paths only.";
    }
    try {
      const content = await readFile(path, "utf-8");
      if (content.length > 50_000) {
        return content.slice(0, 50_000) + "\n\n[Truncated — file exceeds 50KB]";
      }
      return content;
    } catch (e) {
      return `Error reading file: ${(e as Error).message}`;
    }
  },
};

export default tool;
