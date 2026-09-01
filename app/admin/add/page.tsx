import { asc } from "drizzle-orm";
import { db, tags } from "@/db";
import { getSession } from "@/lib/auth";
import a from "../admin.module.css";
import { AddFlow } from "./AddFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "הוספת ציור" };

export default async function AddPage() {
  const session = await getSession();
  const known = db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)).all();

  return (
    <main className={a.shell}>
      <AddFlow
        knownTags={known.map((t) => t.name)}
        /* Free-text tag creation is admin-only (§1) — she picks from what exists. */
        canCreateTags={session?.role === "admin"}
      />
    </main>
  );
}
