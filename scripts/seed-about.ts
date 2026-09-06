/**
 * Puts placeholder prose on the About page so it is not blank while her real
 * text is being written. Safe to re-run; touches nothing but the about row,
 * and never overwrites text that is already there.
 */
import { eq } from "drizzle-orm";
import { db, pages } from "@/db";

const BODY = `בלומה שוורצברג קמין מציירת כבר יותר מחמישים שנה — נופים, דיוקנאות וטבע דומם, כולם נעשו באותו סטודיו מוצף אור.

הארכיון הזה מאסף את עבודתה במקום אחד: הציורים שעל הקירות, אלה שבמחסן, והסיפורים שנלווים אליהם, במילים שלה.

היא התחילה לצייר בשנות השבעים, בין עבודה לגידול ילדים, בשעות שנשארו. מאז לא הפסיקה. חלק מהציורים נמכרו, חלק ניתנו במתנה, והרוב פשוט נשארו — על הקירות, מאחורי הארון, מתחת למיטה.

(הטקסט הזה הוא ממלא מקום. אפשר להחליף אותו בעמוד הניהול.)`;

const existing = db.select().from(pages).where(eq(pages.slug, "about")).get();

if (existing && existing.body.trim()) {
  console.log("about page already has text — left untouched");
} else if (existing) {
  db.update(pages)
    .set({ body: BODY, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(pages.slug, "about"))
    .run();
  console.log("about page filled with placeholder text");
} else {
  db.insert(pages)
    .values({ slug: "about", title: "אודות", body: BODY })
    .run();
  console.log("about page created with placeholder text");
}
