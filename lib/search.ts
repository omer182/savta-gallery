import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { CardPainting } from "./queries";

/**
 * FTS5 search over title / story / tags_text (PLAN.md §3).
 *
 * Verified before adopting: FTS5's unicode61 tokenizer handles Hebrew — word,
 * prefix and phrase matching all work.
 */

/**
 * User input must never reach MATCH raw: bare FTS5 syntax means `"` starts a
 * phrase, `*` is a wildcard, and `AND`/`OR`/`NEAR` are operators, so a stray
 * quote is a syntax error rather than a search. Each token is quoted as a
 * literal, with a trailing `*` for prefix matching on the last one.
 */
export function toMatchQuery(input: string): string | null {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, ""))
    .filter(Boolean);

  if (tokens.length === 0) return null;

  return tokens
    .map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`))
    .join(" AND ");
}

export function searchPublished(query: string, limit = 48): CardPainting[] {
  const match = toMatchQuery(query);
  if (!match) return [];

  try {
    return db.all<CardPainting>(sql`
      SELECT
        p.id            AS id,
        p.public_id     AS publicId,
        p.title         AS title,
        p.year          AS year,
        p.medium        AS medium,
        p.width_cm      AS widthCm,
        p.height_cm     AS heightCm,
        i.derived_hash  AS derivedHash,
        i.width         AS imgWidth,
        i.height        AS imgHeight,
        i.thumbhash     AS thumbhash
      FROM paintings_fts f
      JOIN paintings p ON p.id = f.rowid
      LEFT JOIN images i ON i.painting_id = p.id AND i.is_primary = 1
      WHERE paintings_fts MATCH ${match}
        AND p.status = 'published'
      ORDER BY rank
      LIMIT ${limit}
    `);
  } catch {
    // A malformed MATCH should read as "no results", never a 500.
    return [];
  }
}
