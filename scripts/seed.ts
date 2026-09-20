/**
 * Sample content so the gallery has something to render before the real
 * digitization sessions (PLAN.md §11) produce anything.
 *
 * Placeholder paintings only — no image files yet; the image pipeline is
 * build step 3. Safe to re-run: it clears and repopulates.
 */
import { db, paintings, paintingTags, pages, tags } from "@/db";
import { newPublicId, slugifyTitle } from "@/lib/slug";

type Seed = {
  title: string;
  year: number;
  medium: string;
  widthCm: number;
  heightCm: number;
  tags: string[];
  story: string[];
};

const SEEDS: Seed[] = [
  {
    title: "חורשת זיתים בין ערביים",
    year: 1998,
    medium: "שמן על בד",
    widthCm: 80,
    heightCm: 60,
    tags: ["נוף", "שמן", "שנות ה־90"],
    story: [
      "ציירתי שלושה ערבים ברציפות מאחורי הבית הישן, כשהאור הפך את עלי הזית לכסופים.",
      "השארתי את הבד הלא־גמור ליד דלת המטבח, כדי לתפוס בכל יום בדיוק את אותה שעה.",
    ],
  },
  {
    title: "שוק, בוקר",
    year: 2004,
    medium: "שמן על בד",
    widthCm: 100,
    heightCm: 70,
    tags: ["עיר", "שמן", "שנות ה־2000"],
    story: ["דוכני התבלינים לפני שהקהל מגיע. הדבר הקשה ביותר היה לצייר את הריח."],
  },
  {
    title: "דיוקן נאוה",
    year: 1986,
    medium: "שמן על לוח",
    widthCm: 45,
    heightCm: 55,
    tags: ["דיוקן", "שמן", "שנות ה־80"],
    story: [
      "אחותי ישבה בשביל הציור הזה אחר צהריים ארוך של שבת, והתלוננה כל הזמן. התלונות נראות בפה, אני מבטיחה.",
    ],
  },
  {
    title: "חלון בחורף",
    year: 2012,
    medium: "אקוורל",
    widthCm: 35,
    heightCm: 50,
    tags: ["טבע דומם", "אקוורל", "שנות ה־2010"],
    story: ["גשם על חלון הסטודיו, גרניום על אדן החלון. אחד האקוורלים הבודדים שלא זרקתי."],
  },
  {
    title: "הסירה הכחולה",
    year: 1979,
    medium: "שמן על בד",
    widthCm: 120,
    heightCm: 80,
    tags: ["ים", "שמן", "שנות ה־70"],
    story: [
      "מהקיץ הראשון ביפו. הסירה הייתה של דייג בשם אברם, שגבה ממני ציור אחד עבור כל חודש של בקרים על המזח שלו.",
      "הוא בחר ציור אחר.",
    ],
  },
  {
    title: "כלניות",
    year: 2019,
    medium: "שמן על בד",
    widthCm: 40,
    heightCm: 40,
    tags: ["פרחים", "שמן", "שנות ה־2010"],
    story: [
      "פרחים מהשוק, ביום שישי בבוקר. ציירתי מהר, לפני שנסגרו.",
      "אני אוהבת את הציור הזה כי לא היה לו זמן להיות זהיר.",
    ],
  },
  {
    title: "מדרגות בצפת",
    year: 1991,
    medium: "שמן על בד",
    widthCm: 60,
    heightCm: 90,
    tags: ["עיר", "שמן", "שנות ה־90"],
    story: [
      "מדרגות התכלת של רובע האמנים. ציירתי מחדש את השליש העליון ארבע פעמים, במרדף אחרי הסגול המדויק של הצל בצהריים.",
    ],
  },
  {
    title: "דיוקן עצמי בגיל 73",
    year: 2021,
    medium: "שמן על לוח",
    widthCm: 50,
    heightCm: 60,
    tags: ["דיוקן", "שמן", "שנות ה־2020"],
    story: ["עשיתי אותו מול המראה הגדולה מהמסדרון. את הידיים ציירתי קודם. את הפנים כבר הכרתי."],
  },
  {
    title: "הדרים ומפה",
    year: 2008,
    medium: "שמן על בד",
    widthCm: 55,
    heightCm: 45,
    tags: ["טבע דומם", "שמן", "שנות ה־2000"],
    story: ["תפוזים מהעץ של השכן, על מפת השולחן של אמא שלי. ציור שקט על שני דורות באותו מטבח."],
  },
];

const ABOUT = `בלומה שורצברג קמין מציירת כבר יותר מחמישים שנה — נופים, דיוקנאות וטבע דומם, כולם נעשו באותו סטודיו מוצף אור.

הארכיון הזה מאסף את עבודתה במקום אחד: הציורים שעל הקירות, אלה שבמחסן, והסיפורים שנלווים אליהם, במילים שלה.`;

function seed() {
  // Order matters: painting_tags has FKs both ways.
  db.delete(paintingTags).run();
  db.delete(paintings).run();
  db.delete(tags).run();
  db.delete(pages).run();

  const tagId = new Map<string, number>();
  for (const name of new Set(SEEDS.flatMap((s) => s.tags))) {
    const [row] = db
      .insert(tags)
      .values({ name, slug: slugifyTitle(name) })
      .returning({ id: tags.id })
      .all();
    tagId.set(name, row!.id);
  }

  SEEDS.forEach((s, i) => {
    const [p] = db
      .insert(paintings)
      .values({
        publicId: newPublicId(),
        title: s.title,
        year: s.year,
        medium: s.medium,
        widthCm: s.widthCm,
        heightCm: s.heightCm,
        story: s.story.join("\n\n"),
        status: "published",
        provenance: "artist",
        sortOrder: i,
        createdBy: "admin",
      })
      .returning({ id: paintings.id })
      .all();

    for (const t of s.tags) {
      db.insert(paintingTags).values({ paintingId: p!.id, tagId: tagId.get(t)! }).run();
    }
  });

  db.insert(pages).values({ slug: "about", title: "אודות", body: ABOUT }).run();

  console.log(`seeded ${SEEDS.length} paintings, ${tagId.size} tags, 1 page`);
}

seed();
