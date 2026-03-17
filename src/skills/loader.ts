import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../types.js";
import type { SkillManifest, SkillEntry } from "./types.js";

/**
 * Scan a skills directory for skill.yaml/skill.yml manifests.
 * Returns lightweight entries (name + description only) for lazy loading.
 */
export async function scanSkills(skillsDirs: string[]): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];

  for (const dir of skillsDirs) {
    try {
      const items = await readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory()) continue;
        const skillDir = join(dir, item.name);
        const manifest = await loadManifestHeader(skillDir);
        if (manifest) {
          entries.push({
            name: manifest.name,
            description: manifest.description,
            dirPath: skillDir,
            loaded: false,
          });
        }
      }
    } catch {
      // Directory doesn't exist — skip silently
    }
  }

  log("info", "Skills scanned", { count: entries.length });
  return entries;
}

/**
 * Load the full manifest for a skill (lazy — only when skill is triggered).
 */
export async function loadSkillFull(entry: SkillEntry): Promise<SkillManifest> {
  if (entry.manifest) return entry.manifest;

  const manifestPath = await findManifestFile(entry.dirPath);
  if (!manifestPath) throw new Error(`No manifest found for skill: ${entry.name}`);

  const raw = await readFile(manifestPath, "utf-8");
  const manifest = parseYamlFrontmatter(raw);
  entry.manifest = manifest;
  entry.loaded = true;

  // Load prompt from separate file if referenced
  if (manifest.prompt.endsWith(".md") || manifest.prompt.endsWith(".txt")) {
    const promptPath = join(entry.dirPath, manifest.prompt);
    manifest.prompt = await readFile(promptPath, "utf-8");
  }

  return manifest;
}

async function findManifestFile(dir: string): Promise<string | null> {
  for (const name of ["skill.yaml", "skill.yml", "SKILL.md"]) {
    const path = join(dir, name);
    try {
      await readFile(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadManifestHeader(dir: string): Promise<{ name: string; description: string } | null> {
  const path = await findManifestFile(dir);
  if (!path) return null;

  try {
    const raw = await readFile(path, "utf-8");

    // Parse YAML frontmatter (between --- markers)
    const manifest = parseYamlFrontmatter(raw);
    return { name: manifest.name, description: manifest.description };
  } catch {
    return null;
  }
}

/**
 * Simple YAML frontmatter parser — avoids adding js-yaml dependency.
 * Parses key: value pairs from --- delimited frontmatter block.
 */
function parseYamlFrontmatter(raw: string): SkillManifest {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  const body = fmMatch ? raw.slice(fmMatch[0].length).trim() : raw;
  const fmBlock = fmMatch ? fmMatch[1] : "";

  const fields: Record<string, string> = {};
  for (const line of fmBlock.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) fields[match[1]] = match[2].trim();
  }

  // Parse arrays (triggers, tools) — format: [a, b, c] or comma-separated
  function parseArray(val?: string): string[] {
    if (!val) return [];
    const clean = val.replace(/^\[/, "").replace(/\]$/, "");
    return clean.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  }

  return {
    name: fields.name ?? "unnamed",
    description: fields.description ?? "",
    version: fields.version ?? "0.1.0",
    triggers: parseArray(fields.triggers),
    model: fields.model,
    tools: fields.tools ? parseArray(fields.tools) : undefined,
    prompt: body || fields.prompt || "",
  };
}
