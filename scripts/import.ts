/**
 * Bulk import for the digitization sessions — PLAN.md §11.
 *
 *   npm run import -- <session-dir> [--dry-run] [--mode name|exif] [--gap 30]
 *
 * Runs on the home server, never against a network share: SQLite over SMB/NFS
 * breaks file locking and can corrupt the database.
 *
 * Two ways to pair photos with manifest rows:
 *
 * - "name" (preferred, and auto-detected): photos are named by number —
 *   1.jpg, 2.jpg, 2b.jpg — and the manifest has a `num` column. Pairing is by
 *   NUMBER, so a missing photo or a missing row is reported instead of
 *   silently shifting every painting after it by one.
 *
 * - "exif": photos arrive unnamed and are grouped by EXIF timestamp gap.
 *   Order-based, so one bad gap misaligns everything downstream. Kept as the
 *   fallback for a session shot without numbering.
 *
 * CRITICAL: derivatives are NOT generated here. Imported photos still contain
 * wall, floor and sticky note; building derivatives now would produce ~4,500
 * files of a sticky note, and any failure to regenerate them would publish
 * photographs of paintings with notes taped beside them. Rows land as
 * needs_crop, and the crop pass triggers processing.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import exifr from "exifr";
import { db, images, paintings, paintingTags } from "@/db";
import { storeOriginal } from "@/lib/images";
import { createPainting, upsertTags } from "@/lib/mutations";
import { DATA_DIR } from "@/lib/paths";

const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;
const AUDIO_EXT = /\.(m4a|mp3|wav|aac|ogg)$/i;

/** Column names accepted for the picture number, so the CSV can be hand-made. */
const NUM_KEYS = ["num", "number", "pic", "pic_number", "photo", "id", "מספר"];

type Row = Record<string, string>;
type Photo = { file: string; time: number; hadExif: boolean; num: number | null };
type Entry = { num: number; row: Row | null; files: Photo[] };

function parseArgs() {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const dry = argv.includes("--dry-run");

  const at = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const gap = Number(at("--gap"));
  const mode = at("--mode");

  return {
    dir,
    dry,
    gapSeconds: Number.isFinite(gap) && gap > 0 ? gap : 30,
    mode: mode === "name" || mode === "exif" ? mode : null,
  };
}

/** Minimal CSV reader: handles quoted fields, embedded commas and newlines. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  // A BOM from Excel would otherwise become part of the first header name.
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function rowNum(row: Row): number | null {
  for (const k of NUM_KEYS) {
    const v = row[k];
    if (v !== undefined && v !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

/** Leading digits of the filename stem: 1.jpg, 2b.jpg and 2-2.jpg → 1, 2, 2. */
function fileNum(file: string): number | null {
  const stem = path.basename(file).replace(/\.[^.]+$/, "");
  const m = stem.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

async function readPhotos(dir: string): Promise<Photo[]> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => PHOTO_EXT.test(f))
    .map((f) => path.join(dir, f));

  const out: Photo[] = [];
  for (const file of files) {
    let time: number | null = null;
    try {
      const ex = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
      const d = (ex?.DateTimeOriginal ?? ex?.CreateDate) as Date | undefined;
      if (d instanceof Date && !Number.isNaN(d.getTime())) time = d.getTime();
    } catch {
      /* fall through to mtime */
    }
    out.push({
      file,
      time: time ?? fs.statSync(file).mtimeMs,
      hadExif: time !== null,
      num: fileNum(file),
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Pairs by number. Frames of one painting sort by full filename (1, 1b, 1c). */
function groupByName(photos: Photo[], rows: Row[]): Entry[] {
  const byNum = new Map<number, Photo[]>();
  for (const p of photos) {
    if (p.num === null) continue;
    const list = byNum.get(p.num) ?? [];
    list.push(p);
    byNum.set(p.num, list);
  }
  for (const list of byNum.values()) {
    list.sort((a, b) => path.basename(a.file).localeCompare(path.basename(b.file), "en"));
  }

  const rowByNum = new Map<number, Row>();
  for (const r of rows) {
    const n = rowNum(r);
    if (n !== null) rowByNum.set(n, r);
  }

  const nums = Array.from(new Set([...byNum.keys(), ...rowByNum.keys()])).sort((a, b) => a - b);
  return nums.map((num) => ({
    num,
    row: rowByNum.get(num) ?? null,
    files: byNum.get(num) ?? [],
  }));
}

/** Order-based fallback: consecutive paintings are separated by a long gap. */
function groupByExif(photos: Photo[], rows: Row[], gapSeconds: number): Entry[] {
  const groups: Photo[][] = [];
  let cur: Photo[] = [];
  let last: number | null = null;

  for (const p of photos) {
    if (last !== null && p.time - last > gapSeconds * 1000) {
      groups.push(cur);
      cur = [];
    }
    cur.push(p);
    last = p.time;
  }
  if (cur.length) groups.push(cur);

  return groups.map((files, i) => ({ num: i + 1, row: rows[i] ?? null, files }));
}

async function main() {
  const { dir, dry, gapSeconds, mode } = parseArgs();
  if (!dir) {
    console.error("usage: npm run import -- <session-dir> [--dry-run] [--mode name|exif]");
    process.exit(1);
  }

  const root = path.resolve(dir);
  const photosDir = path.join(root, "photos");
  const audioDir = path.join(root, "audio");
  const manifestPath = path.join(root, "manifest.csv");

  for (const p of [root, photosDir]) {
    if (!fs.existsSync(p)) {
      console.error(`missing: ${p}`);
      process.exit(1);
    }
  }

  const rows = fs.existsSync(manifestPath) ? parseCsv(fs.readFileSync(manifestPath, "utf8")) : [];
  const photos = await readPhotos(photosDir);

  const named = photos.length > 0 && photos.every((p) => p.num !== null);
  const rowsNumbered = rows.length > 0 && rows.every((r) => rowNum(r) !== null);
  const useName = mode ? mode === "name" : named && rowsNumbered;

  const entries = useName
    ? groupByName(photos, rows)
    : groupByExif(photos, rows, gapSeconds);

  const audio = fs.existsSync(audioDir)
    ? fs.readdirSync(audioDir).filter((f) => AUDIO_EXT.test(f)).sort()
    : [];
  const audioByNum = new Map<number, string>();
  for (const f of audio) {
    const n = fileNum(f);
    if (n !== null) audioByNum.set(n, f);
  }

  /* ---------------- report ---------------- */
  console.log(`\nsession       : ${root}`);
  console.log(`pairing       : ${useName ? "by file number" : `by EXIF gap (${gapSeconds}s)`}`);
  console.log(`photos        : ${photos.length}`);
  console.log(`manifest rows : ${rows.length}`);
  console.log(`paintings     : ${entries.length}`);
  console.log(`audio memos   : ${audio.length}`);

  if (!useName && named && !rowsNumbered && rows.length) {
    console.log(
      "\n!  Photos are numbered but the manifest has no number column." +
        `\n   Add one of: ${NUM_KEYS.join(", ")} — then pairing is by number, not order.`,
    );
  }

  const noExif = photos.filter((p) => !p.hadExif).length;
  if (!useName && noExif) {
    console.log(`\n!  ${noExif} photo(s) had no EXIF timestamp; fell back to file mtime.`);
    console.log("   Transfer with Image Capture / AirDrop originals to preserve EXIF.");
  }

  // With number pairing these are precise: exactly which number is unmatched.
  const noPhoto = entries.filter((e) => e.files.length === 0);
  const noRow = entries.filter((e) => !e.row);
  if (noPhoto.length) {
    console.log(`\n!  ${noPhoto.length} manifest row(s) with NO photo: ${noPhoto.map((e) => e.num).join(", ")}`);
  }
  if (noRow.length) {
    console.log(`\n!  ${noRow.length} photo group(s) with NO manifest row: ${noRow.map((e) => e.num).join(", ")}`);
  }

  console.log("\nproposed pairing:");
  for (const e of entries) {
    const title = e.row?.title?.trim() || "(no manifest row)";
    console.log(
      `  #${String(e.num).padStart(3)}  ${String(e.files.length).padStart(2)} frame(s)  ` +
        `${audioByNum.get(e.num) ? "♪" : "–"}  ${title}`,
    );
  }

  if (dry) {
    console.log("\n--dry-run: nothing was written.\n");
    return;
  }

  const importable = entries.filter((e) => e.files.length > 0);
  if (importable.length === 0) {
    console.log("\nnothing to import: no photo groups.\n");
    return;
  }

  /* ---------------- import ---------------- */
  console.log("\nimporting…");
  let created = 0;

  for (const e of importable) {
    const row = e.row ?? {};
    const title = row.title?.trim() || `ללא שם ${e.num}`;
    const num = (v: string | undefined) => {
      const n = Number(v);
      return v?.trim() && Number.isFinite(n) ? n : null;
    };

    const painting = createPainting(
      {
        title,
        year: num(row.year),
        medium: row.medium || null,
        widthCm: num(row.width_cm),
        heightCm: num(row.height_cm),
        // The story comes from the transcript, corrected later in the story
        // pass. Blank is fine and expected at this stage.
        story: row.story || null,
        provenance: (row.provenance as "artist" | "sold" | "gifted" | "unknown") || "unknown",
      },
      "import",
    );

    const tagNames = (row.tags ?? "")
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagNames.length) {
      for (const tagId of new Set(upsertTags(tagNames))) {
        db.insert(paintingTags).values({ paintingId: painting.id, tagId }).run();
      }
    }

    // First frame is primary; the rest are additional images in filename order
    // (signature, back, texture) — §11.
    for (let j = 0; j < e.files.length; j++) {
      const buf = fs.readFileSync(e.files[j]!.file);
      const stored = await storeOriginal(buf);
      db.insert(images)
        .values({
          paintingId: painting.id,
          originalPath: stored.relPath,
          originalHash: stored.hash,
          exifJson: stored.exif ? JSON.stringify(stored.exif) : null,
          isPrimary: j === 0,
          sortOrder: j,
          // Deliberately left pending: the crop pass triggers processing.
          processingStatus: "pending",
        })
        .run();
    }

    const memo = audioByNum.get(e.num) ?? (useName ? undefined : audio[created]);
    if (memo) {
      // Stored relative to DATA_DIR, because that is what the audio route
      // resolves against. Keep sessions under /data.
      const abs = path.join(audioDir, memo);
      db.update(paintings)
        .set({ audioPath: path.relative(DATA_DIR, abs).split(path.sep).join("/") })
        .where(eq(paintings.id, painting.id))
        .run();
    }

    db.update(paintings)
      .set({ needsCrop: true, needsReview: true })
      .where(eq(paintings.id, painting.id))
      .run();

    created++;
    if (created % 25 === 0) console.log(`  … ${created}/${importable.length}`);
  }

  console.log(`\ndone: ${created} paintings imported as drafts, awaiting crop.`);
  console.log("next: /admin/import/crop  →  then /admin/import/stories\n");
}

void main();
