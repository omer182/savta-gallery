/**
 * Demo paintings, so the gallery has a real wall to look at before the
 * digitization sessions (PLAN.md §11) produce anything.
 *
 * Twenty landscapes across five subjects and five media, with sizes and dates that
 * hang together. The proportions are the point: they run from a 150cm panorama
 * to an upright half again as tall as it is wide, which is the spread a mosaic
 * needs before it reads as a mosaic rather than a grid with uneven bottoms.
 *
 * The images are public-domain paintings from the Art Institute of Chicago
 * (CC0), uncropped, and pushed through the same pipeline as a real upload, so
 * the derived hash, thumbhash and intrinsic size in the database are genuinely
 * what the gallery will be working with on the day.
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
 * A painter really does return to the same subject, so "בריכת הטחנה ג׳" is how
 * the third of them would actually be listed.
 */
const ORDINALS = ["", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳"];

/* ------------------------------------------------------------------ *
 * The paintings
 *
 * Ratio is height / width, and it is the painting's own: nothing in the first
 * pass is cropped. The spread still runs from a 3.5:1 panorama to a 1:1.5
 * upright, which is what makes a mosaic look like a mosaic rather than a grid
 * with uneven bottoms.
 * ------------------------------------------------------------------ */
type Demo = {
  title: string;
  year: number;
  medium: string;
  /** Canvas width; the height follows from the ratio. */
  widthCm: number;
  /** height / width of the painting itself. */
  ratio: number;
  /**
   * IIIF image id of a public-domain landscape at the Art Institute of
   * Chicago (CC0). Stand-ins until her own paintings are photographed.
   */
  aic: string;
  /** The real work, so nobody mistakes a stand-in for hers. */
  source: string;
  tags: string[];
  story: string;
};

/**
 * Five tags and five media, and no more. A tag strip is only useful while it
 * can be read at a glance - twenty tags for twenty paintings is a list, not a
 * filter.
 */
const TAGS = {
  landscape: "נוף",
  sea: "ים",
  forest: "יער",
  mountains: "הרים",
  water: "נהר ואגם",
} as const;

const MEDIA = {
  oilCanvas: "שמן על בד",
  oilBoard: "שמן על לוח",
  water: "אקוורל",
  pastel: "פסטל על נייר",
  gouache: "גואש על נייר",
} as const;

const DEMO: Demo[] = [
  {
    title: "סערה מעל הגבעות",
    year: 1976, medium: MEDIA.oilCanvas, widthCm: 150, ratio: 0.28,
    aic: "976bc367-269d-17ff-0151-16b9c973aae4", source: "Elihu Vedder, Storm in Umbria, 1875",
    tags: [TAGS.landscape],
    story: "הפס הארוך הזה נצבע על בד שנתפר משתי יריעות, כי שום מסגרת מוכנה לא הייתה רחבה מספיק. את העננים ציירתי ביום אחד, לפני שהגשם הגיע.",
  },
  {
    title: "רצועת ים",
    year: 2022, medium: MEDIA.oilCanvas, widthCm: 140, ratio: 0.465,
    aic: "50f98ea2-ea74-d991-b2fc-ddbc616283bd", source: "John Frederick Kensett, Near Newport, 1869",
    tags: [TAGS.sea],
    story: "הציור הרחב ביותר שציירתי אי פעם. הוא לקח שלושה חודשים, ורוב הזמן הזה רק הסתכלתי עליו בלי לגעת.",
  },
  {
    title: "מפרץ בערפל",
    year: 2001, medium: MEDIA.oilCanvas, widthCm: 100, ratio: 0.5,
    aic: "3192ae4d-ffca-fe91-af12-2ca681f43e13", source: "Martin Johnson Heade, York Harbor, Coast of Maine, 1877",
    tags: [TAGS.sea],
    story: "השמש עמדה מאחורי הערפל כמו מטבע. ניסיתי שבע פעמים לצייר את האור הזה עד שהפסקתי לנסות, וזה מה שנשאר.",
  },
  {
    title: "בריכה בין העצים",
    year: 1981, medium: MEDIA.oilCanvas, widthCm: 95, ratio: 0.6,
    aic: "1501b057-0441-f1fa-e949-298b06ec6270", source: "Jean-Baptiste-Camille Corot, Landscape, 1865/70",
    tags: [TAGS.water],
    story: "ציירתי בצל, בשעה שבה הכול כבר ירוק-אפור. הסירה הקטנה הגיעה באמצע ונשארה בציור.",
  },
  {
    title: "חוף מתחת לצוקים",
    year: 1994, medium: MEDIA.oilCanvas, widthCm: 110, ratio: 0.63,
    aic: "4c5abec2-d94f-9afa-b689-de4dc93791f2", source: "William Bradford, The Coast of Labrador, 1866",
    tags: [TAGS.sea],
    story: "הצוקים נראו זהובים רק בבוקר מוקדם. ירדתי לחוף שלושה ימים ברצף כדי לתפוס את זה.",
  },
  {
    title: "ערפל עולה בשקיעה",
    year: 2006, medium: MEDIA.oilCanvas, widthCm: 80, ratio: 0.654,
    aic: "30491751-fb43-fc27-51fe-d068be7b6568", source: "Sanford Robinson Gifford, Mist Rising at Sunset in the Catskills, c. 1861",
    tags: [TAGS.mountains],
    story: "השמש שוקעת שם מהר יותר משחשבתי. את השמיים ציירתי מהזיכרון, למחרת בבוקר.",
  },
  {
    title: "ערימת חציר בשלג",
    year: 1999, medium: MEDIA.oilCanvas, widthCm: 65, ratio: 0.7,
    aic: "db36f74f-47d9-ad08-cdf9-b4b436e6d18c", source: "Claude Monet, Stack of Wheat (Snow Effect, Overcast Day), 1890–91",
    tags: [TAGS.landscape],
    story: "השלג אף פעם לא לבן באמת. בציור הזה אין אפילו נגיעה אחת של לבן נקי.",
  },
  {
    title: "סירות על הנהר",
    year: 2010, medium: MEDIA.oilBoard, widthCm: 60, ratio: 0.714,
    aic: "c4425cb6-d8b5-6390-603d-7f802406d05d", source: "Alfred Sisley, The Seine at Port-Marly, Piles of Sand, 1875",
    tags: [TAGS.water],
    story: "הדייגים לא זזו כל הבוקר, אז היה לי זמן. המים זזו בשבילם.",
  },
  {
    title: "בריכה קטנה ליד הים",
    year: 2016, medium: MEDIA.pastel, widthCm: 50, ratio: 0.717,
    aic: "b4ee4891-5d7b-11ad-93df-2b64e34de991", source: "Childe Hassam, The Little Pond, Appledore, 1890",
    tags: [TAGS.water],
    story: "הפרחים הלבנים היו בכל מקום באותו קיץ. ציירתי מהר, לפני שהשמש עברה לצד השני.",
  },
  {
    title: "אחרי גשם של קיץ",
    year: 2018, medium: MEDIA.oilCanvas, widthCm: 70, ratio: 0.759,
    aic: "a9546ba5-6191-4e04-e209-d22a10e7d0d7", source: "George Inness, After a Summer Shower, 1894",
    tags: [TAGS.landscape],
    story: "הקשת הופיעה לכמה דקות ונעלמה. את השדה ציירתי אחר כך, אבל את הקשת כבר הייתי צריכה לזכור.",
  },
  {
    title: "הסכר",
    year: 2003, medium: MEDIA.oilCanvas, widthCm: 58, ratio: 0.775,
    aic: "ff3b5c8a-5b14-5c35-8775-3d021e92a381", source: "John Constable, Landscape (The Lock), c. 1820–25",
    tags: [TAGS.water],
    story: "מקום חשוך וקריר באמצע אוגוסט. הענף הלבן הוא הדבר הראשון שציירתי, וכל השאר נבנה סביבו.",
  },
  {
    title: "סלעים מול הגלים",
    year: 1985, medium: MEDIA.oilBoard, widthCm: 60, ratio: 0.797,
    aic: "de060306-b5a3-5139-cad9-57e9c274d7c3", source: "Winslow Homer, Coast of Maine, 1893",
    tags: [TAGS.sea],
    story: "הרוח הייתה כל כך חזקה שהחזקתי את הלוח ביד אחת. הקצף יצא בדיוק כמו שרציתי.",
  },
  {
    title: "נהר בסתיו",
    year: 1979, medium: MEDIA.oilCanvas, widthCm: 55, ratio: 0.835,
    aic: "bcc9c3a7-f5b0-41af-210a-bd17797d77d9", source: "Alfred Sisley, The Loire, 1896",
    tags: [TAGS.water],
    story: "העצים כבר איבדו את רוב העלים. אהבתי שאפשר לראות דרכם את השמיים.",
  },
  {
    title: "גשר מעל בריכת חבצלות",
    year: 2012, medium: MEDIA.oilCanvas, widthCm: 60, ratio: 0.889,
    aic: "8534685d-1102-e1e3-e194-94f6e925e8b0", source: "Claude Monet, Water Lily Pond, 1900",
    tags: [TAGS.water],
    story: "ישבתי על אותו ספסל כל בוקר במשך שבוע. ביום האחרון הבנתי שאני מציירת את ההשתקפות, לא את הגשר.",
  },
  {
    title: "בתים על המצוק",
    year: 1997, medium: MEDIA.oilCanvas, widthCm: 55, ratio: 1,
    aic: "f72dbf42-8655-8788-d899-9e87a0466d28", source: "Childe Hassam, New England Headlands, 1899",
    tags: [TAGS.sea],
    story: "מלמעלה הכפר נראה כמו צעצוע. ציירתי אותו מהגבעה, עם הגב לרוח.",
  },
  {
    title: "פלג בהרים",
    year: 2021, medium: MEDIA.oilCanvas, widthCm: 50, ratio: 1.228,
    aic: "d55b0cfc-0716-d6cd-3b38-5742903ce046", source: "Albert Bierstadt, Mountain Brook, 1863",
    tags: [TAGS.forest],
    story: "שמעתי את המים הרבה לפני שראיתי אותם. ירדתי עם כל הציוד בשביל צר, ולא הצטערתי לרגע.",
  },
  {
    title: "ערוץ באור זהוב",
    year: 1983, medium: MEDIA.oilCanvas, widthCm: 48, ratio: 1.247,
    aic: "dd91d801-7155-a7ee-bfb5-70b94e43e100", source: "Sanford Robinson Gifford, Kauterskill Clove, Catskill Mountains, 1880",
    tags: [TAGS.mountains],
    story: "האוויר בערוץ היה מלא אבק וזהב. הכול נראה רחוק יותר משהיה באמת.",
  },
  {
    title: "בריכת הטחנה",
    year: 1992, medium: MEDIA.oilCanvas, widthCm: 45, ratio: 1.304,
    aic: "f837e639-5a6c-3043-3c2c-a4d5ece3bf1d", source: "George Inness, The Mill Pond, 1889",
    tags: [TAGS.forest],
    story: "העץ האדום הזה היה היחיד שהתחיל להחליף צבע. כל השאר הסכימו לחכות עוד שבוע.",
  },
  {
    title: "חורשה בערב",
    year: 2008, medium: MEDIA.oilBoard, widthCm: 40, ratio: 1.349,
    aic: "4339f21a-5a1c-8f40-931c-32686eefd8d5", source: "Constant Troyon, A Clump of Trees, c. 1860",
    tags: [TAGS.forest],
    story: "העצים כבר כהים והשמיים עוד בהירים. יש בערך עשר דקות כאלה ביום, וזה כל מה שהיה לי.",
  },
  {
    title: "יער אורנים מעל האגם",
    year: 2017, medium: MEDIA.oilCanvas, widthCm: 50, ratio: 1.496,
    aic: "07bdc94a-7d44-fde8-c0e1-f19fefce359d", source: "Gustave Doré, Alpine Scene, 1865",
    tags: [TAGS.forest],
    story: "גזעים ישרים וגבוהים, ובסוף שלהם אור. ציירתי אותם גבוהים יותר משהם באמת, וזה לא היה בטעות.",
  },
];

/* ------------------------------------------------------------------ *
 * Images
 *
 * The IIIF server returns the same bytes for the same request, so a re-run
 * fetches byte-identical originals and the content-addressed store treats it
 * as a no-op. Needs network at seed time; artic.edu refuses requests without
 * an AIC-User-Agent header.
 * ------------------------------------------------------------------ */
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "AIC-User-Agent": "savta-gallery demo seed" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res;
    } catch (e) {
      if (attempt >= 3) throw new Error(`fetching ${url}: ${(e as Error).message}`);
    }
  }
}

/** The server refuses to upscale, so ask for no more than the scan has. */
async function fetchPainting(imageId: string, width: number): Promise<Buffer> {
  const base = `https://www.artic.edu/iiif/2/${imageId}`;
  const info = (await (await get(`${base}/info.json`)).json()) as { width: number };
  const res = await get(`${base}/full/${Math.min(width, info.width)},/0/default.jpg`);
  return Buffer.from(await res.arrayBuffer());
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
    // Repeats are cropped to their varied ratio; the first pass is the
    // painting as painted.
    const w = 1800;
    const full = await fetchPainting(d.aic, w);
    const jpeg =
      pass === 0
        ? full
        : await sharp(full).resize(w, Math.round(w * ratio), { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();

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
