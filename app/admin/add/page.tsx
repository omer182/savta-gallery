import { asc, isNotNull } from "drizzle-orm";
import { db, paintings, tags } from "@/db";
import { getSession } from "@/lib/auth";
import a from "../admin.module.css";
import { AddFlow } from "./AddFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "הוספת ציור" };

/** Seeds the technique chips so common values do not have to be retyped. */
const BASE_MEDIA = ["שמן על בד", "שמן על לוח", "אקוורל", "רישום"];

export default async function AddPage() {
  const session = await getSession();

  const known = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();

  // Techniques already in use join the defaults, so the list grows with her
  // vocabulary instead of staying a fixed guess.
  const used = db
    .selectDistinct({ medium: paintings.medium })
    .from(paintings)
    .where(isNotNull(paintings.medium))
    .all();

  const media = Array.from(
    new Set([...BASE_MEDIA, ...used.map((m) => m.medium).filter((m): m is string => !!m)]),
  );

  return (
    <main className={a.shell}>
      <AddFlow
        knownTags={known.map((t) => t.name)}
        knownMedia={media}
        isAdmin={session?.role === "admin"}
      />
    </main>
  );
}
