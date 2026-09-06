/**
 * Bundles the CLI scripts to plain JS for the container.
 *
 * The Next standalone output carries no tsx and no TypeScript, so the
 * migration runner and the bulk importer have to arrive as runnable .mjs.
 * Native modules stay external — they are real binaries and cannot be bundled.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/migrate.ts", "scripts/import.ts"],
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
