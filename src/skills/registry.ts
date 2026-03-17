import type { SkillEntry, SkillManifest } from "./types.js";
import { scanSkills, loadSkillFull } from "./loader.js";
import { log } from "../types.js";

export interface SkillRegistry {
  readonly entries: SkillEntry[];
  init(dirs: string[]): Promise<void>;
  match(text: string): SkillEntry | null;
  load(entry: SkillEntry): Promise<SkillManifest>;
  summaries(): string;
}

export function createSkillRegistry(): SkillRegistry {
  let entries: SkillEntry[] = [];

  return {
    get entries() {
      return entries;
    },

    async init(dirs: string[]) {
      entries = await scanSkills(dirs);
    },

    match(text: string): SkillEntry | null {
      const lower = text.toLowerCase().trim();

      // Check /command triggers first
      if (lower.startsWith("/")) {
        const cmd = lower.split(/\s/)[0]; // e.g. "/help"
        for (const entry of entries) {
          if (!entry.manifest?.triggers) continue;
          for (const trigger of entry.manifest.triggers) {
            if (trigger === cmd) return entry;
          }
        }
      }

      // Check keyword triggers
      for (const entry of entries) {
        if (!entry.manifest?.triggers) continue;
        for (const trigger of entry.manifest.triggers) {
          if (!trigger.startsWith("/") && lower.includes(trigger.toLowerCase())) {
            return entry;
          }
        }
      }

      return null;
    },

    async load(entry: SkillEntry): Promise<SkillManifest> {
      return loadSkillFull(entry);
    },

    summaries(): string {
      if (entries.length === 0) return "";
      return entries
        .map((e) => `- ${e.name}: ${e.description}`)
        .join("\n");
    },
  };
}
