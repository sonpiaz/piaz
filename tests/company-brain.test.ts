import { describe, it, expect } from "vitest";
import { chunkText } from "../src/brain/ingest.js";

describe("Company Brain - Chunking", () => {
  it("chunks text into overlapping segments", () => {
    const text = "A".repeat(2500);
    const chunks = chunkText(text, 1000, 200);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be at most ~1100 chars (size + some boundary tolerance)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1100);
    }
  });

  it("handles short text as single chunk", () => {
    const chunks = chunkText("Hello world", 1000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Hello world");
  });

  it("prefers paragraph boundaries", () => {
    const text =
      "First paragraph with lots of content here.\n\n" +
      "Second paragraph with different content.\n\n" +
      "Third paragraph continues the discussion.";

    const chunks = chunkText(text, 80, 20);
    // Should break at \n\n when possible
    expect(chunks[0]).toContain("First paragraph");
  });

  it("handles empty text", () => {
    const chunks = chunkText("", 1000, 200);
    expect(chunks).toHaveLength(0);
  });
});
