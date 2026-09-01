/**
 * Bulk import for the digitization sessions — PLAN.md §11.
 *
 *   npm run import -- <session-dir> [--dry-run] [--gap 30]
 *
 * Runs on the home server, never against a network share: SQLite over SMB/NFS
 * breaks file locking and can corrupt the database.
 *
 * Photos arrive flat and in shooting order. They are grouped by EXIF timestamp
 * gap — frames of one painting are seconds apart, consecutive paintings are
 * separated by a swap, a dust, a typed row and a recorded story. Groups pair 1:1
 * with manifest rows in order, and the numbered sticky note visible in each
 * frame is the human-readable check.
 *
 * CRITICAL: derivatives are NOT generated here. Imported photos still contain
 * wall, floor and sticky note; building derivatives now would produce ~4,500
 * files of a sticky note, and any failure to regenerate them would publish
 * photographs of paintings with notes taped beside them. Rows land as
 * needs_crop, and the crop pass triggers processing.
 */
import fs from "node:fs";
import path from "node:path";
import exifr from "exifr";
import { db, images, paintings } from "@/db";
import { storeOriginal } from "@/lib/images";
import { DATA_DIR } from "@/lib/paths";
import { createPainting, upsertTags } from "@/lib/mutations";
import { eq } from "drizzle-orm";
import { paintingTags } from "@/db";

const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;
const AUDIO_EXT = /\.(m4a|mp3|wav|aac|ogg)$/i;

type Row = Record<string, string>;

function parseArgs() {
  const argv = process.argv.slice(2);
  const dir = argv.find((a) => !a.startsWith("--"));
  const dry = argv.includes("--dry-run");
  const gapIdx = argv.indexOf("--gap");
  const gap = gapIdx >= 0 ? Number(argv[gapIdx + 1]) : 30;
  return { dir, dry, gapSeconds: Number.isFinite(gap) ? gap : 30 };
}

/** Minimal CSV reader: handles quoted fields, embedded commas and newlines. */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
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

async function photoTimes(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => PHOTO_EXT.test(f))
    .map((f) => path.join(dir, f));

  const out: Array<{ file: string; time: number; hadExif: boolean }> = [];
  for (const file of files) {
    let time: number | null = null;
    try {
      const ex = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
      const d = (ex?.DateTimeOriginal ?? ex?.CreateDate) as Date | undefined;
      if (d instanceof Date && !Number.isNaN(d.getTime())) time = d.getTime();
    } catch {
      /* fall through to mtime */
    }
    const hadExif = time !== null;
    out.push({ file, time: time ?? fs.statSync(file).mtimeMs, hadExif });
  }
  return out.sort((a, b) => a.time - b.time);
}

function cluster(photos: Awaited<ReturnType<typeof photoTimes>>, gapSeconds: number) {
  const groups: (typeof photos)[] = [];
  let cur: typeof photos = [];
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
  return groups;
}

async function main() {
  const { dir, dry, gapSeconds } = parseArgs();
  if (!dir) {
    console.error("usage: npm run import -- <session-dir> [--dry-run] [--gap 30]");
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

  const rows = fs.existsSync(manifestPath)
    ? parseCsv(fs.readFileSync(manifestPath, "utf8"))
    : [];
  const photos = await photoTimes(photosDir);
  const groups = cluster(photos, gapSeconds);

  const audio = fs.existsSync(audioDir)
    ? fs.readdirSync(audioDir).filter((f) => AUDIO_EXT.test(f)).sort()
    : [];

  /* ---------------- report ---------------- */
  console.log(`\nsession       : ${root}`);
  console.log(`photos        : ${photos.length}`);
  console.log(`clusters      : ${groups.length}   (gap threshold ${gapSeconds}s)`);
  console.log(`manifest rows : ${rows.length}`);
  console.log(`audio memos   : ${audio.length}`);

  const noExif = photos.filter((p) => !p.hadExif).length;
  if (noExif) {
    console.log(`\n!  ${noExif} photo(s) had no EXIF timestamp; fell back to file mtime.`);
    console.log("   Transfer with Image Capture / AirDrop originals to preserve EXIF.");
  }

  if (rows.length && rows.length !== groups.length) {
    console.log(
      `\n!  MISMATCH: ${groups.length} clusters vs ${rows.length} manifest rows.` +
        `\n   Check the sticky-note numbers before importing. Try adjusting --gap.`,
    );
  }

  // Gaps close to the threshold are where clustering is most likely wrong.
  const borderline: string[] = [];
  for (let i = 1; i < photos.length; i++) {
    const d = (photos[i]!.time - photos[i - 1]!.time) / 1000;
    if (d > gapSeconds * 0.6 && d < gapSeconds * 1.8) {
      borderline.push(`   ${path.basename(photos[i]!.file)}  (+${d.toFixed(0)}s)`);
    }
  }
  if (borderline.length) {
    console.log(`\n!  ${borderline.length} borderline gap(s) near the threshold:`);
    console.log(borderline.slice(0, 12).join("\n"));
  }

  console.log("\nproposed pairing:");
  groups.forEach((g, i) => {
    const row = rows[i];
    const title = row?.title || row?.["שם"] || "(no manifest row)";
    console.log(
      `  ${String(i + 1).padStart(3)}  ${g.length} frame(s)  ${audio[i] ? "♪" : "–"}  ${title}`,
    );
  });

  if (dry) {
    console.log("\n--dry-run: nothing was written.\n");
    return;
  }

  /* ---------------- import ---------------- */
  console.log("\nimporting…");
  let created = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    const row = rows[i] ?? {};

    const title = row.title?.trim() || `ללא שם ${i + 1}`;
    const num = (v: string | undefined) => {
      const n = Number(v);
      return Number.isFinite(n) && v?.trim() ? n : null;
    };

    const painting = createPainting(
      {
        title,
        year: num(row.year),
        medium: row.medium || null,
        widthCm: num(row.width_cm),
        heightCm: num(row.height_cm),
        // The story comes from the transcript column, corrected later in the
        // story pass. Blank is fine and expected at this stage.
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

    // First frame of the cluster is primary; the rest are additional images in
    // shooting order (signature, back, texture) — §11.
    for (let j = 0; j < group.length; j++) {
      const buf = fs.readFileSync(group[j]!.file);
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

    if (audio[i]) {
      // Stored relative to DATA_DIR, because that is what the audio route
      // resolves against. A session folder outside DATA_DIR yields an absolute
      // path, which that route will refuse — so keep sessions under /data.
      const abs = path.join(audioDir, audio[i]!);
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
    if (created % 25 === 0) console.log(`  … ${created}/${groups.length}`);
  }

  console.log(`\ndone: ${created} paintings imported as drafts.`);
  console.log("next: /admin/import/crop  →  then /admin/import/stories\n");
}

void main();
