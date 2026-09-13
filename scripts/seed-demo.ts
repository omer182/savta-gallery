/**
 * Demo paintings, so the gallery has a real wall to look at before the
 * digitization sessions (PLAN.md §11) produce anything.
 *
 * Twenty works across five subjects and five media, with sizes and dates that
 * hang together. The proportions are the point: they run from a 150cm panorama
 * to an upright twice as tall as it is wide, which is the spread a mosaic needs
 * before it reads as a mosaic rather than a grid with uneven bottoms.
 *
 * The images are generated, not photographed: warm abstract washes built as SVG
 * and pushed through the same pipeline as a real upload, so the derived hash,
 * thumbhash and intrinsic size in the database are genuinely what the gallery
 * will be working with on the day.
 *
 *   npm run db:seed-demo                 the twenty demo paintings
 *   npm run db:seed-demo -- --count 120  more, by repeating the catalogue
 *   npm run db:seed-demo -- --clear      remove them again
 *
 * In the container, where there is no tsx:
 *   node dist/scripts/seed-demo.mjs [--count N | --clear]
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
  /** Real canvas width; the height follows from the ratio. */
  widthCm: number;
  /** height / width. */
  ratio: number;
  kind: Kind;
  tags: string[];
  story: string;
};

/**
 * Five tags and five media, and no more. A tag strip is only useful while it
 * can be read at a glance - twenty tags for twenty paintings is a list, not a
 * filter. These five are the subjects she actually returns to.
 */
const TAGS = {
  landscape: "נוף",
  portrait: "דיוקן",
  still: "טבע דומם",
  sea: "ים",
  abstract: "מופשט",
} as const;

const MEDIA = {
  oilCanvas: "שמן על בד",
  oilBoard: "שמן על לוח",
  water: "אקוורל",
  pastel: "פסטל על נייר",
  gouache: "גואש על נייר",
} as const;

/**
 * Ratio is height / width, and the spread is the whole point: a 2.2:1 panorama
 * and a 1:2.15 upright in the same wall are what make a mosaic look like a
 * mosaic instead of a grid with uneven bottoms.
 */
const DEMO: Demo[] = [
  {
    title: "בקעה בשעת בין ערביים",
    year: 1976, medium: MEDIA.oilCanvas, widthCm: 150, ratio: 0.45,
    kind: "landscape", tags: [TAGS.landscape],
    story: "הפס הארוך הזה נצבע על בד שנתפר משתי יריעות, כי שום מסגרת מוכנה לא הייתה רחבה מספיק. עבדתי עליו רק בשעה שלפני החשכה, ולכן הוא לקח קיץ שלם.",
  },
  {
    title: "רצועת ים",
    year: 2022, medium: MEDIA.oilCanvas, widthCm: 140, ratio: 0.52,
    kind: "landscape", tags: [TAGS.sea],
    story: "הציור הרחב ביותר שציירתי אי פעם. הוא לקח שלושה חודשים, ורוב הזמן הזה רק הסתכלתי עליו בלי לגעת.",
  },
  {
    title: "רכס, בוקר מוקדם",
    year: 1981, medium: MEDIA.oilCanvas, widthCm: 100, ratio: 0.6,
    kind: "landscape", tags: [TAGS.landscape],
    story: "ציירתי מהחלון של חדר האורחים, לפני שכולם התעוררו. ההר משנה צבע שלוש פעמים בין חמש לשבע.",
  },
  {
    title: "מפרץ אחרי הגשם",
    year: 2001, medium: MEDIA.oilCanvas, widthCm: 95, ratio: 0.68,
    kind: "landscape", tags: [TAGS.sea],
    story: "האור שאחרי הגשם הוא האור הקשה ביותר לצייר, כי הוא לא נשאר. ניסיתי שבע פעמים עד שהפסקתי לנסות.",
  },
  {
    title: "שדות בדרך לצפון",
    year: 1994, medium: MEDIA.oilCanvas, widthCm: 110, ratio: 0.74,
    kind: "landscape", tags: [TAGS.landscape],
    story: "עצרנו בצד הדרך ואני ציירתי מהמושב הקדמי. הרוח הזיזה לי את הנייר כל הזמן, ובסוף השארתי את הקיפול בפנים.",
  },
  {
    title: "לימונים על מפה כחולה",
    year: 2006, medium: MEDIA.oilCanvas, widthCm: 60, ratio: 0.8,
    kind: "still", tags: [TAGS.still],
    story: "המפה הזאת עברה אליי מאמא שלי והיא ישנה משנינו. הלימונים היו מהעץ של השכן, שלא ידע שאני לוקחת.",
  },
  {
    title: "כדים על אדן חלון",
    year: 1999, medium: MEDIA.oilBoard, widthCm: 50, ratio: 0.88,
    kind: "still", tags: [TAGS.still],
    story: "שלושה כדים שקניתי בשוק בעכו בשנות השישים. ציירתי אותם עשרים פעם ובכל פעם הם יצאו אחרת.",
  },
  {
    title: "חצר בצהריים",
    year: 2010, medium: MEDIA.water, widthCm: 45, ratio: 0.95,
    kind: "landscape", tags: [TAGS.landscape],
    story: "אקוורל בחוץ, בחום של אוגוסט. הצבע התייבש לי על המכחול לפני שהספקתי להגיע לנייר.",
  },
  {
    title: "אנמונים",
    year: 2016, medium: MEDIA.oilCanvas, widthCm: 40, ratio: 1,
    kind: "still", tags: [TAGS.still],
    story: "הבן שלי הביא אותם בשבת. עד יום שלישי הם כבר נבלו, אז ציירתי מהר, ורואים את זה.",
  },
  {
    title: "ריבוע של אור",
    year: 2018, medium: MEDIA.oilBoard, widthCm: 50, ratio: 1,
    kind: "abstract", tags: [TAGS.abstract],
    story: "בלי נושא. רק ניסיתי לתפוס איך האור נופל על רצפת הסטודיו בארבע אחר הצהריים, לפני שהוא זז.",
  },
  {
    title: "תאנים ולחם",
    year: 2003, medium: MEDIA.oilCanvas, widthCm: 58, ratio: 1.08,
    kind: "still", tags: [TAGS.still],
    story: "ארוחת בוקר שלא הספקתי לאכול, כי התחלתי לצייר אותה. אכלתי את התאנים אחר כך, כבר מהציור.",
  },
  {
    title: "דיוקן של שכנה",
    year: 1985, medium: MEDIA.oilBoard, widthCm: 45, ratio: 1.16,
    kind: "portrait", tags: [TAGS.portrait],
    story: "היא ישבה לי שלושה ימי שישי ברצף ולא הפסיקה לדבר אפילו לרגע. התלונות נראות בפה, אני מבטיחה.",
  },
  {
    title: "ילדה עם צמה",
    year: 1979, medium: MEDIA.pastel, widthCm: 40, ratio: 1.25,
    kind: "portrait", tags: [TAGS.portrait],
    story: "הנכדה הגדולה, כשהייתה בת שש. היום יש לה ילדים משלה, ואחד מהם יושב בדיוק באותה צורה.",
  },
  {
    title: "חלון בחורף",
    year: 2012, medium: MEDIA.water, widthCm: 35, ratio: 1.34,
    kind: "still", tags: [TAGS.still],
    story: "גשם על חלון הסטודיו וגרניום על האדן. זה אחד האקוורלים הבודדים שלא זרקתי לפח באותו חורף.",
  },
  {
    title: "עץ זית זקן",
    year: 1997, medium: MEDIA.oilCanvas, widthCm: 65, ratio: 1.4,
    kind: "landscape", tags: [TAGS.landscape],
    story: "העץ הזה עמד שם לפני כולנו ויעמוד שם אחרינו. ציירתי אותו בשנה שבה עברנו לבית ממול.",
  },
  {
    title: "דיוקן עצמי עם מטפחת",
    year: 2021, medium: MEDIA.oilBoard, widthCm: 50, ratio: 1.48,
    kind: "portrait", tags: [TAGS.portrait],
    story: "עשיתי אותו מול המראה הגדולה מהמסדרון. את הידיים ציירתי קודם — את הפנים כבר הכרתי.",
  },
  {
    title: "אישה קוראת",
    year: 1983, medium: MEDIA.oilCanvas, widthCm: 55, ratio: 1.6,
    kind: "portrait", tags: [TAGS.portrait],
    story: "אחותי, עם ספר, ליד המנורה הצהובה שהייתה לנו בסלון. היא לא ידעה שאני מציירת אותה.",
  },
  {
    title: "סולם אל הגג",
    year: 1992, medium: MEDIA.gouache, widthCm: 48, ratio: 1.75,
    kind: "abstract", tags: [TAGS.abstract],
    story: "התחיל כציור של סולם והפך למשהו אחר לגמרי. השארתי לו את השם הראשון כי הוא עוד מגיע לאנשהו.",
  },
  {
    title: "ברושים",
    year: 2008, medium: MEDIA.oilCanvas, widthCm: 55, ratio: 1.95,
    kind: "landscape", tags: [TAGS.landscape],
    story: "שני ברושים בכניסה לקיבוץ. ציירתי אותם גבוהים יותר משהם באמת, וזה לא היה בטעות.",
  },
  {
    title: "אור מבעד לתריס",
    year: 2017, medium: MEDIA.gouache, widthCm: 38, ratio: 2.15,
    kind: "abstract", tags: [TAGS.abstract],
    story: "פסים של אור על הקיר בשעת אחר הצהריים. זה כל הציור, ולא היה צריך יותר מזה.",
  },
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
        // Her real canvas sizes, and they agree with the image proportions.
        widthCm: d.widthCm,
        heightCm: Math.round(d.widthCm * ratio),
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
