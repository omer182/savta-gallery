import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import sharp, { type Sharp } from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { DERIVATIVE_WIDTHS, JPEG_FALLBACK_WIDTH } from "./imageUrls";
import { DERIVED_DIR, ORIGINALS_DIR } from "./paths";

/**
 * Image pipeline — PLAN.md §4.
 *
 * The server only ever receives JPEG/PNG/WebP: HEIC is converted client-side for
 * web uploads, and shot as JPEG for the bulk import (§11), because sharp's
 * prebuilt binaries cannot decode HEIC.
 */

export type CropRect = { x: number; y: number; width: number; height: number };

export type StoredOriginal = {
  hash: string;
  relPath: string;
  width: number;
  height: number;
  exif: Record<string, unknown> | null;
};

const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

/** Shard by the first two hash chars so no directory holds ~13k files. */
const shardOf = (hash: string) => hash.slice(0, 2);

/**
 * Stores the received bytes untouched as the archival original of record and
 * records its EXIF. Never re-encodes: whatever arrived is what is kept.
 */
export async function storeOriginal(buf: Buffer): Promise<StoredOriginal> {
  const hash = sha(buf);
  const meta = await sharp(buf).metadata();
  const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg";

  const dir = path.join(ORIGINALS_DIR, shardOf(hash));
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, `${hash}.${ext}`);

  // Content-addressed: identical bytes are the same file, so re-import is a no-op.
  await fs.writeFile(abs, buf, { flag: "wx" }).catch((e) => {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  });

  let exif: Record<string, unknown> | null = null;
  try {
    exif = (await exifr.parse(buf, { pick: ["DateTimeOriginal", "Make", "Model"] })) ?? null;
  } catch {
    exif = null; // absent or unparseable EXIF must never fail an upload
  }

  return {
    hash,
    relPath: path.posix.join(shardOf(hash), `${hash}.${ext}`),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    exif,
  };
}

export function originalAbsPath(relPath: string) {
  return path.join(ORIGINALS_DIR, relPath);
}

/** ~30-byte blur placeholder. thumbhash requires the source to be at most 100x100. */
async function computeThumbhash(img: Sharp): Promise<string> {
  const { data, info } = await img
    .clone()
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hash = rgbaToThumbHash(info.width, info.height, data);
  return Buffer.from(hash).toString("base64");
}

export type DerivativeResult = {
  /** Hash of the *cropped* pixels — the derivative URLs are keyed on this. */
  derivedHash: string;
  width: number;
  height: number;
  thumbhash: string;
};

/**
 * Generates every public derivative from a stored original, optionally applying
 * a crop first.
 *
 * The crop is applied HERE, server-side, for imported paintings: they arrive
 * uncropped with a numbered sticky note in frame, so derivatives must not be
 * built until the crop pass has confirmed a rectangle (§11). Web uploads arrive
 * already cropped and simply pass no rect.
 *
 * All metadata is dropped — sharp strips EXIF unless explicitly kept, so
 * capture data survives only in the DB, never in a public file (§4).
 */
export async function generateDerivatives(
  originalRelPath: string,
  crop?: CropRect | null,
): Promise<DerivativeResult> {
  const abs = originalAbsPath(originalRelPath);
  const input = sharp(await fs.readFile(abs), { failOn: "none" }).rotate(); // honour EXIF orientation

  const cropped = crop
    ? input.extract({
        left: Math.max(0, Math.round(crop.x)),
        top: Math.max(0, Math.round(crop.y)),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      })
    : input;

  // Materialise once so every derivative works from identical pixels, and so the
  // derived hash reflects the crop rather than the original.
  const baseBuf = await cropped.clone().png({ compressionLevel: 0 }).toBuffer();
  const base = sharp(baseBuf);
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const derivedHash = sha(baseBuf);
  const dir = path.join(DERIVED_DIR, shardOf(derivedHash));
  await fs.mkdir(dir, { recursive: true });

  const targets = DERIVATIVE_WIDTHS.filter((w) => w <= width);
  // A source narrower than the smallest target still deserves one derivative.
  if (targets.length === 0) targets.push(DERIVATIVE_WIDTHS[0]);

  await Promise.all([
    ...targets.flatMap((w) => [
      base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .avif({ quality: 60, effort: 4 })
        .toFile(path.join(dir, `${derivedHash}-${w}.avif`)),
      base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(dir, `${derivedHash}-${w}.webp`)),
    ]),
    base
      .clone()
      .resize({ width: JPEG_FALLBACK_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(dir, `${derivedHash}-${JPEG_FALLBACK_WIDTH}.jpg`)),
  ]);

  return { derivedHash, width, height, thumbhash: await computeThumbhash(base) };
}

/**
 * The original's dimensions AFTER EXIF rotation is applied.
 *
 * sharp's metadata() always describes the input, so for a photo carrying an
 * orientation tag of 5-8 (the sideways ones every phone produces) width and
 * height are reported the wrong way round relative to what the pipeline
 * actually produces — `sharp(buf).rotate()` swaps them. Crop rectangles are
 * expressed against the rotated image, so they must be scaled against these
 * numbers, not the raw ones.
 */
export async function orientedSize(
  originalRelPath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(originalAbsPath(originalRelPath)).metadata();
    if (!meta.width || !meta.height) return null;
    const swap = (meta.orientation ?? 1) >= 5;
    return {
      width: swap ? meta.height : meta.width,
      height: swap ? meta.width : meta.height,
    };
  } catch {
    return null;
  }
}

/** Percentage rect (0-100, against the rotated original) → pixel rect. */
export async function pixelRectFromPercent(
  originalRelPath: string,
  pct: { x: number; y: number; width: number; height: number },
): Promise<CropRect | null> {
  const size = await orientedSize(originalRelPath);
  if (!size) return null;

  const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), max));
  const x = clamp((pct.x / 100) * size.width, size.width - 1);
  const y = clamp((pct.y / 100) * size.height, size.height - 1);
  const width = clamp((pct.width / 100) * size.width, size.width - x);
  const height = clamp((pct.height / 100) * size.height, size.height - y);

  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}
