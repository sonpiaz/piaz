import type { ToolDef } from "./types.js";
import { getDb } from "../db/index.js";
import { searchKnowledgeBM25 } from "../db/queries.js";

const tool: ToolDef = {
  name: "memory_search",
  description:
    "Search the organization's knowledge base for relevant information. Uses full-text search to find matching documents.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default 5)",
      },
    },
    required: ["query"],
  },

  async execute(input, ctx) {
    const query = input.query as string;
    const limit = (input.limit as number) ?? 5;

    try {
      const db = getDb();
      const results = await searchKnowledgeBM25(db, ctx.orgId, query, limit);

      if (results.length === 0) {
        return "No matching knowledge found.";
      }

      return results
        .map(
          (r, i) =>
            `[${i + 1}] Source: ${r.source}\n${r.content}`,
        )
        .join("\n\n---\n\n");
    } catch (e) {
      return `Error searching knowledge: ${(e as Error).message}`;
    }
  },
};

export default tool;
