import { writeFile, readFile, readdir, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../types.js";
import { writeR2 } from "./r2-writer.js";

const BUFFER_DIR = ".piaz-buffer";
let draining = false;

async function ensureDir() {
  await mkdir(BUFFER_DIR, { recursive: true });
}

export async function bufferWrite(r2Path: string, content: string): Promise<void> {
  await ensureDir();
  const fileName = `${Date.now()}-${r2Path.replace(/\//g, "__")}`;
  const filePath = join(BUFFER_DIR, fileName);
  const entry = JSON.stringify({ r2Path, content });
  await writeFile(filePath, entry, "utf-8");
  log("warn", "Buffered R2 write to local disk", { r2Path, file: fileName });
}

export async function drainBuffer(): Promise<number> {
  if (draining) return 0;
  draining = true;

  let drained = 0;
  try {
    await ensureDir();
    const files = await readdir(BUFFER_DIR);
    if (files.length === 0) return 0;

    log("info", "Draining local buffer", { pending: files.length });

    for (const file of files.sort()) {
      const filePath = join(BUFFER_DIR, file);
      try {
        const raw = await readFile(filePath, "utf-8");
        const { r2Path, content } = JSON.parse(raw) as { r2Path: string; content: string };
        await writeR2(r2Path, content);
        await unlink(filePath);
        drained++;
      } catch (e) {
        log("error", "Failed to drain buffer entry", {
          file,
          error: (e as Error).message,
        });
        break; // Stop draining on first failure — R2 likely still down
      }
    }
  } finally {
    draining = false;
  }

  if (drained > 0) log("info", "Buffer drained", { count: drained });
  return drained;
}

export async function pendingCount(): Promise<number> {
  try {
    await ensureDir();
    const files = await readdir(BUFFER_DIR);
    return files.length;
  } catch {
    return 0;
  }
}

// Periodic drain: try every 30s
let drainInterval: ReturnType<typeof setInterval> | null = null;

export function startDrainLoop() {
  if (drainInterval) return;
  drainInterval = setInterval(() => {
    drainBuffer().catch((e) =>
      log("error", "Drain loop error", { error: (e as Error).message }),
    );
  }, 30_000);
}

export function stopDrainLoop() {
  if (drainInterval) {
    clearInterval(drainInterval);
    drainInterval = null;
  }
}
