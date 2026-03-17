import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "../config.js";
import * as schema from "./schema.js";

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const sql = neon(config.db.url());
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

export type Db = ReturnType<typeof getDb>;

export { schema };
