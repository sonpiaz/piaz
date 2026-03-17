import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { config } from "../config.js";
import { log } from "../types.js";

export async function runMigrations() {
  const sql = neon(config.db.url());

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT now() NOT NULL
    )
  `;

  // Read and apply migration files
  const migrations = ["0000_init.sql"];

  for (const name of migrations) {
    // Check if already applied
    const existing = await sql`SELECT 1 FROM _migrations WHERE name = ${name}`;
    if (existing.length > 0) {
      log("debug", `Migration ${name} already applied, skipping`);
      continue;
    }

    const filePath = new URL(`../../drizzle/${name}`, import.meta.url).pathname;
    const content = await readFile(filePath, "utf-8");

    // Execute migration
    await sql(content);

    // Record it
    await sql`INSERT INTO _migrations (name) VALUES (${name})`;
    log("info", `Migration applied: ${name}`);
  }

  log("info", "Migrations complete");
}
