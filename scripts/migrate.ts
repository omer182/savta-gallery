/**
 * Applies pending migrations. Runs on container start (PLAN.md §7) and locally
 * via `npm run db:migrate`.
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/db";

migrate(db, { migrationsFolder: "./db/migrations" });
console.log("migrations applied");
