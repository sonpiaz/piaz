import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDef } from "./types.js";

const tool: ToolDef = {
  name: "write_file",
  description: "Write content to a file in the workspace. Creates parent directories if needed.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path to the file within the workspace",
      },
      content: {
        type: "string",
        description: "The content to write",
      },
    },
    required: ["path", "content"],
  },

  async execute(input) {
    const path = input.path as string;
    const content = input.content as string;
    if (path.includes("..") || path.startsWith("/")) {
      return "Error: Path traversal not allowed. Use relative paths only.";
    }
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf-8");
      return `Written ${content.length} chars to ${path}`;
    } catch (e) {
      return `Error writing file: ${(e as Error).message}`;
    }
  },
};

export default tool;
