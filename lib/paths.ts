import path from "node:path";

/**
 * All persistent state lives under DATA_DIR (PLAN.md §7) — one SQLite file plus
 * the image tree. In the container this is the /data bind mount; locally it is
 * ./data, which is gitignored.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

export const DB_PATH = path.join(DATA_DIR, "db", "gallery.db");
export const IMAGES_DIR = path.join(DATA_DIR, "images");
export const ORIGINALS_DIR = path.join(IMAGES_DIR, "originals");
export const DERIVED_DIR = path.join(IMAGES_DIR, "derived");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");
