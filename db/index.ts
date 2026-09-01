import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DB_PATH } from "@/lib/paths";
import * as schema from "./schema";

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);

  // WAL lets the public site read while an upload writes; NORMAL sync is the
  // right durability trade for a single-writer archive on one box.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

// Next dev server hot-reloads modules; without caching we would leak a file
// handle per reload and eventually hit SQLITE_BUSY.
const g = globalThis as unknown as { __galleryDb?: ReturnType<typeof open> };
export const db = g.__galleryDb ?? open();
if (process.env.NODE_ENV !== "production") g.__galleryDb = db;

export * from "./schema";
