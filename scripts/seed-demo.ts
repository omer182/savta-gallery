/**
 * Demo paintings, for looking at the gallery.
 *
 * The real archive is ~500 works of every proportion (PLAN.md §11), and a
 * mosaic only shows its character at that kind of volume and variety — six
 * near-square placeholders tell you nothing about how the wall reads. This
 * fabricates enough paintings, in enough shapes, to judge it.
 *
 * The images are generated, not photographs: warm abstract washes built as SVG
 * and rendered through the same pipeline as a real upload, so what lands in the
 * DB (derived hash, thumbhash, intrinsic size) is genuinely what the gallery
 * will get on the day.
 *
 *   npm run db:seed-demo                 add the demo paintings
 *   npm run db:seed-demo -- --count 120  as many as you like, for paging
 *   npm run db:seed-demo -- --clear      remove them again
 *
 * Every row is tagged provenanceNote = "demo-seed", which is how --clear finds
 * them, so real paintings entered by hand are never touched.
 */
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, images, paintings, paintingTags, tags } from "@/db";
import { generateDerivatives, storeOriginal } from "@/lib/images";
import { PAGE_SIZE } from "@/lib/queries";
import { newPublicId, slugifyTitle } from "@/lib/slug";

const MARKER = "demo-seed";

/**
 * Hebrew ordinals, for the repeats past the first pass through the catalogue.
 * A painter really does return to the same subject, so "ברושים ג׳" is how the
 * third of them would actually be listed.
 */
const ORDINALS = ["", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳"];

/* ------------------------------------------------------------------ *
 * The paintings
 *
 * Ratio is height / width. The spread is the point: a 2.6:1 panorama and a
 * 1:1.9 portrait in the same wall are what makes a mosaic look like a mosaic
 * rather than a grid with uneven bottoms.
 * ------------------------------------------------------------------ */
type Kind = "landscape" | "portrait" | "still" | "abstract";

type Demo = {
  title: string;
  year: number;
  medium: string;
  ratio: number;
  kind: Kind;
  tags: string[];
  story: string;
};

const MEDIA = {
  oilCanvas: "שמן על בד",
  oilBoard: "שמן על לוח",
  water: "אקוורל",
  pastel: "פסטל על נייר",
} as const;

const DEMO: Demo[] = [
  { title: "בקעה בשעת בין ערביים", year: 1976, medium: MEDIA.oilCanvas, ratio: 0.42, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־70"], story: "הפס הארוך הזה נצבע על בד שנתפר משתי יריעות, כי שום מסגרת מוכנה לא הייתה רחבה מספיק." },
  { title: "רכס, בוקר מוקדם", year: 1981, medium: MEDIA.oilCanvas, ratio: 0.55, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־80"], story: "ציירתי מהחלון של חדר האורחים, לפני שכולם התעוררו." },
  { title: "שדות בדרך לצפון", year: 1994, medium: MEDIA.oilCanvas, ratio: 0.62, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־90"], story: "עצרנו בצד הדרך ואני ציירתי מהמושב הקדמי. הרוח הזיזה לי את הנייר כל הזמן." },
  { title: "מפרץ אחרי הגשם", year: 2001, medium: MEDIA.oilCanvas, ratio: 0.68, kind: "landscape", tags: ["ים", "שמן", "שנות ה־2000"], story: "האור אחרי גשם הוא האור הכי קשה לצייר. ניסיתי שבע פעמים." },
  { title: "גגות של שכונה ישנה", year: 1988, medium: MEDIA.oilBoard, ratio: 0.72, kind: "landscape", tags: ["עיר", "שמן", "שנות ה־80"], story: "הבית באמצע כבר לא קיים. טוב שציירתי אותו." },
  { title: "לימונים על מפה כחולה", year: 2006, medium: MEDIA.oilCanvas, ratio: 0.78, kind: "still", tags: ["טבע דומם", "שמן", "שנות ה־2000"], story: "המפה הזאת עברה אליי מאמא שלי. הלימונים היו מהעץ של השכן." },
  { title: "כדים על אדן חלון", year: 1999, medium: MEDIA.oilBoard, ratio: 0.84, kind: "still", tags: ["טבע דומם", "שמן", "שנות ה־90"], story: "שלושה כדים שקניתי בשוק בעכו בשנות השישים, וציירתי אותם עשרים פעם." },
  { title: "חצר בצהריים", year: 2010, medium: MEDIA.water, ratio: 0.9, kind: "landscape", tags: ["נוף", "אקוורל", "שנות ה־2010"], story: "אקוורל בחוץ, בחום. הצבע התייבש לי על המכחול." },
  { title: "אנמונים", year: 2016, medium: MEDIA.oilCanvas, ratio: 1, kind: "still", tags: ["טבע דומם", "שמן", "שנות ה־2010"], story: "הבן שלי הביא אותם בשבת. עד יום שלישי הם כבר נבלו, אז ציירתי מהר." },
  { title: "ריבוע של אור", year: 2018, medium: MEDIA.oilBoard, ratio: 1, kind: "abstract", tags: ["מופשט", "שמן", "שנות ה־2010"], story: "בלי נושא. רק ניסיתי לתפוס איך האור נופל על הרצפה בסטודיו בארבע אחר הצהריים." },
  { title: "תאנים ולחם", year: 2003, medium: MEDIA.oilCanvas, ratio: 1.05, kind: "still", tags: ["טבע דומם", "שמן", "שנות ה־2000"], story: "ארוחת בוקר שלא הספקתי לאכול, כי התחלתי לצייר אותה." },
  { title: "דיוקן של שכנה", year: 1985, medium: MEDIA.oilBoard, ratio: 1.15, kind: "portrait", tags: ["דיוקן", "שמן", "שנות ה־80"], story: "היא ישבה לי שלושה ימי שישי ברצף ולא הפסיקה לדבר. הפה יצא מצוין." },
  { title: "ילדה עם צמה", year: 1979, medium: MEDIA.pastel, ratio: 1.22, kind: "portrait", tags: ["דיוקן", "פסטל", "שנות ה־70"], story: "הנכדה הגדולה, כשהיתה בת שש. היום יש לה ילדים משלה." },
  { title: "חלון בחורף", year: 2012, medium: MEDIA.water, ratio: 1.3, kind: "still", tags: ["טבע דומם", "אקוורל", "שנות ה־2010"], story: "גשם על חלון הסטודיו וגרניום על האדן. אחד האקוורלים הבודדים שלא זרקתי." },
  { title: "עץ זית זקן", year: 1997, medium: MEDIA.oilCanvas, ratio: 1.35, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־90"], story: "העץ הזה עמד שם לפני כולנו ויעמוד שם אחרינו." },
  { title: "דיוקן עצמי עם מטפחת", year: 2021, medium: MEDIA.oilBoard, ratio: 1.4, kind: "portrait", tags: ["דיוקן", "שמן", "שנות ה־2020"], story: "מול המראה הגדולה מהמסדרון. את הידיים ציירתי קודם — את הפנים כבר הכרתי." },
  { title: "סולם אל הגג", year: 1992, medium: MEDIA.oilCanvas, ratio: 1.5, kind: "abstract", tags: ["מופשט", "שמן", "שנות ה־90"], story: "התחיל כציור של סולם והפך למשהו אחר לגמרי." },
  { title: "אישה קוראת", year: 1983, medium: MEDIA.oilCanvas, ratio: 1.55, kind: "portrait", tags: ["דיוקן", "שמן", "שנות ה־80"], story: "אחותי, עם ספר, ליד המנורה הצהובה שהיתה לנו בסלון." },
  { title: "ברושים", year: 2008, medium: MEDIA.oilCanvas, ratio: 1.65, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־2000"], story: "שני ברושים בכניסה לקיבוץ. ציירתי אותם גבוהים יותר משהם באמת." },
  { title: "מדרגות בעיר העתיקה", year: 2000, medium: MEDIA.water, ratio: 1.72, kind: "landscape", tags: ["עיר", "אקוורל", "שנות ה־2000"], story: "ישבתי על מדרגה וציירתי את המדרגות שמעליי. אנשים עברו לי בתוך הציור." },
  { title: "דקל צעיר", year: 2014, medium: MEDIA.oilBoard, ratio: 1.85, kind: "landscape", tags: ["נוף", "שמן", "שנות ה־2010"], story: "שתלנו אותו כשנכנסנו לבית. עכשיו הוא גבוה מהגג." },
  { title: "עמוד של תפילה", year: 2019, medium: MEDIA.oilCanvas, ratio: 2.05, kind: "abstract", tags: ["מופשט", "שמן", "שנות ה־2010"], story: "ציור צר וגבוה, כמו דף. לא ידעתי איפה לתלות אותו ובסוף הוא נשאר במסדרון." },
  { title: "רצועת ים", year: 2022, medium: MEDIA.oilCanvas, ratio: 0.38, kind: "landscape", tags: ["ים", "שמן", "שנות ה־2020"], story: "הכי רחב שציירתי אי פעם. לקח שלושה חודשים ורוב הזמן רק הסתכלתי עליו." },
  { title: "אור מבעד לתריס", year: 2017, medium: MEDIA.oilBoard, ratio: 2.35, kind: "abstract", tags: ["מופשט", "שמן", "שנות ה־2010"], story: "פסים של אור על הקיר. זה כל הציור." },
];

/* ------------------------------------------------------------------ *
 * Image generation
 *
 * Deterministic, so re-running produces byte-identical originals and the
 * content-addressed store treats a re-run as a no-op instead of filling the
 * disk with near-duplicates.
 * ------------------------------------------------------------------ */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Warm, dusty, and never fighting the paper the gallery sits on. */
const PALETTES = [
  ["#c9a227", "#8c6a3f", "#5d4a2e", "#e8d9b5"],
  ["#7d8c5c", "#4a5a3a", "#b8a878", "#e3dcc2"],
  ["#a8562f", "#6b3a25", "#d19a6a", "#eddac0"],
  ["#5c7a8c", "#33505f", "#9fb6be", "#e0e4dd"],
  ["#8c5a72", "#5a3448", "#c295a5", "#ecdcd8"],
  ["#b8863f", "#7a5423", "#d9b878", "#f0e4c8"],
];

function paint(w: number, h: number, kind: Kind, seed: number): string {
  const r = rng(seed);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]!;
  const [c1, c2, c3, bg] = pal as [string, string, string, string];
  const parts: string[] = [];

  // A wash, so no two canvases share a flat ground.
  parts.push(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="${r().toFixed(2)}" y2="1">` +
      `<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/>`,
  );

  if (kind === "landscape") {
    // Bands plus a low sun. Reads as a horizon at thumbnail size, which is the
    // only size that matters here.
    const horizon = h * (0.5 + r() * 0.25);
    for (let i = 0; i < 5; i++) {
      const y = horizon + (i * (h - horizon)) / 5;
      parts.push(
        `<rect x="0" y="${y.toFixed(0)}" width="${w}" height="${((h - horizon) / 4).toFixed(0)}" fill="${i % 2 ? c2 : c1}" opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`,
      );
    }
    parts.push(
      `<circle cx="${(w * (0.2 + r() * 0.6)).toFixed(0)}" cy="${(horizon * (0.4 + r() * 0.3)).toFixed(0)}" r="${(Math.min(w, h) * 0.09).toFixed(0)}" fill="${c1}" opacity="0.55"/>`,
    );
    for (let i = 0; i < 3; i++) {
      const cx = w * r();
      parts.push(
        `<ellipse cx="${cx.toFixed(0)}" cy="${(horizon - h * 0.02).toFixed(0)}" rx="${(w * (0.05 + r() * 0.1)).toFixed(0)}" ry="${(h * (0.04 + r() * 0.09)).toFixed(0)}" fill="${c2}" opacity="0.5"/>`,
      );
    }
  } else if (kind === "portrait") {
    const cx = w / 2 + (r() - 0.5) * w * 0.1;
    parts.push(
      `<ellipse cx="${cx.toFixed(0)}" cy="${(h * 0.72).toFixed(0)}" rx="${(w * 0.34).toFixed(0)}" ry="${(h * 0.3).toFixed(0)}" fill="${c2}" opacity="0.75"/>`,
      `<ellipse cx="${cx.toFixed(0)}" cy="${(h * 0.36).toFixed(0)}" rx="${(w * 0.19).toFixed(0)}" ry="${(h * 0.15).toFixed(0)}" fill="${c1}" opacity="0.85"/>`,
      `<rect x="0" y="0" width="${w}" height="${(h * 0.22).toFixed(0)}" fill="${c3}" opacity="0.35"/>`,
    );
  } else if (kind === "still") {
    const table = h * 0.72;
    parts.push(
      `<rect x="0" y="${table.toFixed(0)}" width="${w}" height="${(h - table).toFixed(0)}" fill="${c2}" opacity="0.6"/>`,
    );
    for (let i = 0; i < 4; i++) {
      const rad = Math.min(w, h) * (0.07 + r() * 0.1);
      parts.push(
        `<circle cx="${(w * (0.2 + r() * 0.6)).toFixed(0)}" cy="${(table - rad * (0.6 + r())).toFixed(0)}" r="${rad.toFixed(0)}" fill="${i % 2 ? c1 : c3}" opacity="${(0.65 + r() * 0.3).toFixed(2)}"/>`,
      );
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const bw = w * (0.15 + r() * 0.5);
      const bh = h * (0.05 + r() * 0.4);
      parts.push(
        `<rect x="${(r() * (w - bw)).toFixed(0)}" y="${(r() * (h - bh)).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${[c1, c2, c3][i % 3]}" opacity="${(0.3 + r() * 0.45).toFixed(2)}"/>`,
      );
    }
  }

  // A painted edge, so the tile still reads as a canvas with the mat gone.
  parts.push(
    `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${c2}" stroke-width="${Math.max(4, w * 0.012).toFixed(0)}" opacity="0.35"/>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${parts.join("")}</svg>`;
}

/* ------------------------------------------------------------------ */

async function clear() {
  const rows = db
    .select({ id: paintings.id })
    .from(paintings)
    .where(eq(paintings.provenanceNote, MARKER))
    .all();

  for (const row of rows) {
    db.delete(paintingTags).where(eq(paintingTags.paintingId, row.id)).run();
    db.delete(paintings).where(eq(paintings.id, row.id)).run();
  }
  console.log(`removed ${rows.length} demo paintings (image rows cascade)`);
  console.log("derivative files are left on disk; the orphan sweep collects them");
}

/** `--count N`, default one pass through the catalogue. */
function wantedCount() {
  const i = process.argv.indexOf("--count");
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEMO.length;
}

async function seed() {
  const count = wantedCount();
  const existing = db
    .select({ id: paintings.id })
    .from(paintings)
    .where(eq(paintings.provenanceNote, MARKER))
    .all();
  if (existing.length) {
    console.log(`${existing.length} demo paintings already present — clearing first`);
    await clear();
  }

  // Start after whatever is already in the gallery so real work stays first.
  const maxSort = db.select({ v: paintings.sortOrder }).from(paintings).all();
  let sort = maxSort.reduce((m, r) => Math.max(m, r.v), -1) + 1;

  const tagId = new Map<string, number>();
  for (const name of new Set(DEMO.flatMap((d) => d.tags))) {
    const slug = slugifyTitle(name);
    const found = db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).get();
    if (found) {
      tagId.set(name, found.id);
      continue;
    }
    const [row] = db.insert(tags).values({ name, slug }).returning({ id: tags.id }).all();
    tagId.set(name, row!.id);
  }

  for (let i = 0; i < count; i++) {
    const d = DEMO[i % DEMO.length]!;
    const pass = Math.floor(i / DEMO.length);

    // Past the first pass the catalogue repeats, so vary both the name and the
    // proportions - a wall of the same 24 shapes tells you nothing about how a
    // real archive tiles.
    const title = pass === 0 ? d.title : `${d.title} ${ORDINALS[pass % ORDINALS.length]}`;
    const ratio = pass === 0 ? d.ratio : d.ratio * (0.82 + ((pass * 37) % 45) / 100);
    const year = d.year + (pass % 4);

    // Wide enough that the 1600px derivative is real work, not an upscale.
    const w = 1800;
    const h = Math.round(w * ratio);
    const jpeg = await sharp(Buffer.from(paint(w, h, d.kind, i * 7919 + 13)))
      .jpeg({ quality: 86 })
      .toBuffer();

    const original = await storeOriginal(jpeg);
    const derived = await generateDerivatives(original.relPath);

    const [p] = db
      .insert(paintings)
      .values({
        publicId: newPublicId(),
        title,
        year,
        medium: d.medium,
        // Plausible physical sizes that agree with the image proportions.
        widthCm: 90,
        heightCm: Math.round(90 * ratio),
        story: d.story,
        status: "published",
        provenance: "artist",
        provenanceNote: MARKER,
        sortOrder: sort++,
        createdBy: "admin",
      })
      .returning({ id: paintings.id })
      .all();

    db.insert(images)
      .values({
        paintingId: p!.id,
        originalPath: original.relPath,
        originalHash: original.hash,
        derivedHash: derived.derivedHash,
        width: derived.width,
        height: derived.height,
        thumbhash: derived.thumbhash,
        isPrimary: true,
        sortOrder: 0,
        processingStatus: "done",
      })
      .run();

    for (const t of d.tags) {
      db.insert(paintingTags).values({ paintingId: p!.id, tagId: tagId.get(t)! }).run();
    }

    console.log(`  ${String(i + 1).padStart(3)}/${count}  ${title}`);
  }

  console.log(`\nseeded ${count} demo paintings; the gallery pages at ${PAGE_SIZE}`);
}

const run = process.argv.includes("--clear") ? clear : seed;
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
