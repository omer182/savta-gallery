/**
 * Bundles the CLI scripts to plain JS for the container.
 *
 * The Next standalone output carries no tsx and no TypeScript, so anything that
 * has to be run against the live database on the home server - the migration
 * runner, the bulk importer, and the two seeders used to stand a demo up - must
 * arrive as runnable .mjs. Native modules stay external: they are real binaries
 * and cannot be bundled.
 */
import { build } from "esbuild";

await build({
  entryPoints: [
    "scripts/migrate.ts",
    "scripts/import.ts",
    "scripts/seed-demo.ts",
    "scripts/seed-about.ts",
  ],
  outdir: "dist/scripts",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["better-sqlite3", "sharp"],
  // Mirrors the "@/*" alias from tsconfig.
  alias: { "@": "." },
  logLevel: "info",
});
