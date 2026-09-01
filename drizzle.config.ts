import path from "node:path";
import { defineConfig } from "drizzle-kit";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: path.join(dataDir, "db", "gallery.db") },
  strict: true,
  verbose: true,
});
