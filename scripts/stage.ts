/**
 * Stage a painting — the prototype front end for lib/staging.ts.
 *
 *   npm run stage -- --latest                 the painting added most recently
 *   npm run stage -- --painting 12            a painting already in the archive
 *   npm run stage -- --file D:/photo.jpg      any image on disk
 *   npm run stage -- --painting 12 --scene wall --out out.jpg
 *   npm run stage -- --all 6                  six at once, to judge the range
 *
 * Writes to ./staged/ by default. Nothing here touches the database or the
 * image store: it reads and renders, so it is safe to run against the real
 * archive while deciding whether the idea is any good.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db, images, paintings } from "@/db";
import { fallbackUrl } from "@/lib/imageUrls";
import { DERIVED_DIR } from "@/lib/paths";
import { getScene, SCENES, stage } from "@/lib/staging";

const OUT_DIR = path.resolve("staged");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The processed, cropped derivative — the same pixels the gallery shows. */
function derivedPath(derivedHash: string) {
  const url = fallbackUrl(derivedHash); // /images/derived/ab/abc…-1600.jpg
  return path.join(DERIVED_DIR, url.replace("/images/derived/", ""));
}

type Job = { label: string; file: string };

function fromPainting(id: number): Job {
  const row = db
    .select({ title: paintings.title, hash: images.derivedHash })
    .from(paintings)
    .innerJoin(images, eq(images.paintingId, paintings.id))
    .where(eq(paintings.id, id))
    .get();

  if (!row?.hash) throw new Error(`painting ${id} has no processed image`);
  return { label: `${id}-${row.title}`, file: derivedPath(row.hash) };
}

/**
 * The most recently added painting - which is the one just uploaded, since
 * createPainting sorts new work to the FRONT (sortOrder = min - 1). Ordering
 * by id rather than sortOrder is therefore deliberate: id is when it arrived,
 * sortOrder is where it hangs, and those are not the same question.
 */
function latest(): Job {
  const row = db
    .select({ id: paintings.id, title: paintings.title, hash: images.derivedHash })
    .from(paintings)
    .innerJoin(images, eq(images.paintingId, paintings.id))
    .where(isNotNull(images.derivedHash))
    .orderBy(desc(paintings.id))
    .get();

  if (!row?.hash) {
    throw new Error("no painting with a processed image yet - has the upload finished?");
  }
  console.log(`  painting ${row.id}: ${row.title}`);
  return { label: `${row.id}-${row.title}`, file: derivedPath(row.hash) };
}

/** A spread of shapes rather than the first N, so the range is what gets judged. */
function sample(n: number): Job[] {
  const rows = db
    .select({
      id: paintings.id,
      title: paintings.title,
      hash: images.derivedHash,
      w: images.width,
      h: images.height,
    })
    .from(paintings)
    .innerJoin(images, eq(images.paintingId, paintings.id))
    .where(isNotNull(images.derivedHash))
    .orderBy(desc(paintings.id))
    .all()
    .filter((r) => r.hash && r.w && r.h)
    .sort((a, b) => a.h! / a.w! - b.h! / b.w!);

  if (!rows.length) return [];
  const picks: Job[] = [];
  for (let i = 0; i < Math.min(n, rows.length); i++) {
    const r = rows[Math.round((i * (rows.length - 1)) / Math.max(1, n - 1))]!;
    picks.push({
      label: `${(r.h! / r.w!).toFixed(2)}-${r.title}`,
      file: derivedPath(r.hash!),
    });
  }
  return picks;
}

async function main() {
  const sceneId = arg("scene") ?? "wall";
  const scene = getScene(sceneId);
  if (!scene) {
    console.error(`unknown scene "${sceneId}". available: ${SCENES.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const file = arg("file");
  const painting = arg("painting");
  const all = arg("all");

  const jobs: Job[] = file
    ? [{ label: path.parse(file).name, file }]
    : painting
      ? [fromPainting(Number(painting))]
      : process.argv.includes("--latest")
        ? [latest()]
        : sample(Number(all) || 5);

  if (!jobs.length) {
    console.error("nothing to stage - pass --file, --painting <id>, or seed the archive first");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const explicitOut = arg("out");

  for (const job of jobs) {
    const started = Date.now();
    const input = await fs.readFile(job.file);
    const out = await stage(input, scene);

    const dest =
      explicitOut && jobs.length === 1
        ? path.resolve(explicitOut)
        : path.join(OUT_DIR, `${sceneId}-${job.label.replace(/[^\w\u0590-\u05FF-]+/g, "_")}.jpg`);

    await fs.writeFile(dest, out);
    console.log(`  ${Date.now() - started}ms  ${(out.length / 1024).toFixed(0)}KB  ${dest}`);
  }

  console.log(`\nstaged ${jobs.length} in scene "${scene.name}" (${sceneId})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
