/**
 * Generates a synthetic digitization session for testing the import pipeline
 * without waiting for a real shoot.
 *
 *   npm run test:session -- [count]
 *
 * Mimics the real setup from PLAN.md §11: a painting on a mid-grey matte sheet
 * with 10–15% margin, a numbered sticky note in frame, 2–3 frames per painting
 * seconds apart, and minutes between paintings — so EXIF-gap clustering has
 * something honest to chew on.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR } from "@/lib/paths";

const PALETTES = [
  ["#5b6e4f", "#c9b98a", "#2e3629", "#e8ddc0"],
  ["#b3502e", "#e0a94f", "#7a3220", "#f0e2c8"],
  ["#2f5d7c", "#a8c3cf", "#1d3a4f", "#d9b866"],
  ["#a3283c", "#e5e0d2", "#5c1f2a", "#6e7a54"],
  ["#8f9bc4", "#e3e1ee", "#565f8a", "#cbb489"],
  ["#d99a2b", "#efe6d4", "#8a5a1e", "#5c6e5a"],
];

const TITLES = [
  "חורשת זיתים בין ערביים",
  "שוק, בוקר",
  "דיוקן נאוה",
  "חלון בחורף",
  "הסירה הכחולה",
  "כלניות",
  "מדרגות בצפת",
  "הדרים ומפה",
];

const MEDIA = ["שמן על בד", "שמן על לוח", "אקוורל"];
const TAGS = ["נוף", "עיר", "דיוקן", "טבע דומם", "פרחים", "ים"];

/** The grey sheet, deliberately mid-tone so edge detection has contrast both ways. */
const SHEET = { r: 128, g: 126, b: 120 };

async function frame(n: number, i: number, jitter: number) {
  const pal = PALETTES[n % PALETTES.length]!;
  // Varied canvas proportions — paintings are never uniform.
  const pw = 900 + ((n * 137) % 500);
  const ph = 700 + ((n * 91) % 600);

  // 10–15% margin, plus a little per-frame jitter as a tripod nudge would give.
  const mx = Math.round(pw * 0.13) + jitter;
  const my = Math.round(ph * 0.13) + jitter;
  const W = pw + mx * 2;
  const H = ph + my * 2 + 90; // extra room below for the numbered note

  const art = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${pw}" height="${ph}" fill="${pal[3]}"/>
    <ellipse cx="${pw * 0.35}" cy="${ph * 0.4}" rx="${pw * 0.3}" ry="${ph * 0.28}" fill="${pal[0]}" opacity="0.85"/>
    <ellipse cx="${pw * 0.62}" cy="${ph * 0.55}" rx="${pw * 0.26}" ry="${ph * 0.3}" fill="${pal[1]}" opacity="0.8"/>
    <path d="M0 ${ph * 0.7} Q ${pw * 0.4} ${ph * 0.5}, ${pw} ${ph * 0.66} L${pw} ${ph} L0 ${ph} Z" fill="${pal[2]}" opacity="0.9"/>
  </svg>`;

  // The numbered sticky note lives on the sheet, inside the margin, so the crop
  // removes it along with the wall.
  const note = `<svg width="90" height="70" xmlns="http://www.w3.org/2000/svg">
    <rect width="90" height="70" fill="#f4e58a"/>
    <text x="45" y="48" text-anchor="middle" font-family="Arial" font-size="40" fill="#2a251e">${n + 1}</text>
  </svg>`;

  return sharp({
    create: { width: W, height: H, channels: 3, background: SHEET },
  })
    .composite([
      { input: Buffer.from(art), top: my, left: mx },
      // On the sheet beside the painting with clear separation, as it would be
      // placed in the room. A note touching the canvas edge merges into the
      // detected rectangle - keep a visible gap when shooting.
      { input: Buffer.from(note), top: my + ph + 12, left: mx },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function main() {
  const count = Number(process.argv[2]) || 6;
  const root = path.join(DATA_DIR, "import", "test-session");
  const photos = path.join(root, "photos");

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(photos, { recursive: true });

  const rows = [["title", "year", "medium", "width_cm", "height_cm", "tags", "provenance", "story"]];
  let clock = Date.now() - count * 4 * 60_000;
  let seq = 40;

  for (let n = 0; n < count; n++) {
    const frames = 2 + (n % 2); // 2 or 3 frames, like a real session
    for (let f = 0; f < frames; f++) {
      const buf = await frame(n, f, f * 3);
      const file = path.join(photos, `IMG_${String(seq++).padStart(4, "0")}.jpg`);
      fs.writeFileSync(file, buf);

      // Frames within a painting are seconds apart; the importer clusters on
      // this. mtime is the fallback the importer uses when EXIF is absent.
      clock += 4000;
      fs.utimesSync(file, new Date(clock), new Date(clock));
    }
    // Swap the painting, dust it, type the row, record the story.
    clock += 150_000;

    rows.push([
      TITLES[n % TITLES.length] + (n >= TITLES.length ? ` ${n}` : ""),
      String(1975 + ((n * 7) % 45)),
      MEDIA[n % MEDIA.length]!,
      String(40 + ((n * 13) % 80)),
      String(35 + ((n * 17) % 70)),
      `${TAGS[n % TAGS.length]};שמן`,
      "artist",
      "", // story comes from the transcript, added in the story pass
    ]);
  }

  const csv = rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  fs.writeFileSync(path.join(root, "manifest.csv"), csv, "utf8");

  console.log(`created ${count} paintings (${seq - 40} photos) at:`);
  console.log(`  ${root}`);
  console.log(`\nnext:  npm run import -- "${root}" --dry-run`);
}

void main();
