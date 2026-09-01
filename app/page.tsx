import { asc, eq } from "drizzle-orm";
import { db, paintings } from "@/db";
import { paintingHref } from "@/lib/slug";

/*
 * Placeholder home page. Build step 1 is the scaffold, so this exists only to
 * prove the wiring end to end: server component -> Drizzle -> SQLite -> Hebrew
 * RTL render with the real fonts and tokens. The gallery grid is step 2 and
 * replaces this entirely, following the RTL mock.
 */

// Content is database-backed, so this must not be frozen at build time — a
// statically prerendered gallery would never show a newly published painting.
// Step 2 revisits this as ISR + revalidatePath() on publish, which is cheaper
// behind Cloudflare; force-dynamic is the correct default until then.
export const dynamic = "force-dynamic";

export default function Home() {
  const rows = db
    .select({
      publicId: paintings.publicId,
      title: paintings.title,
      year: paintings.year,
      medium: paintings.medium,
    })
    .from(paintings)
    .where(eq(paintings.status, "published"))
    .orderBy(asc(paintings.sortOrder))
    .all();

  return (
    <main style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "56px var(--pad) 90px" }}>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: "clamp(28px, 6.4vw, 44px)",
          lineHeight: 1.15,
          margin: 0,
        }}
      >
        בלומה שוורצברג קמין
      </h1>
      <p style={{ marginTop: 9, fontSize: 12.5, fontWeight: 300, color: "var(--muted)" }}>
        {rows.length} ציורים · 1974–2026
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
        {rows.map((p) => (
          <li key={p.publicId} style={{ borderBottom: "1px solid var(--line)", padding: "14px 0" }}>
            <a href={paintingHref(p.publicId, p.title)}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 21 }} dir="auto">
                {p.title}
              </span>
              <span style={{ fontSize: 13, fontWeight: 300, color: "var(--muted)" }} dir="auto">
                {"  "}
                {p.year} · {p.medium}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
