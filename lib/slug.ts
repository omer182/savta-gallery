/**
 * URLs are `<publicId>-<hebrew title>`, e.g. `a7f3km-הסירה-הכחולה` (PLAN.md §12).
 *
 * Only the id identifies the painting. The Hebrew tail is decorative, so renaming
 * a painting never breaks a link and a request carrying a stale (or missing) tail
 * still resolves — the route canonical-redirects to the current form.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 6;

/** Crypto-random base36 id. 36^6 ≈ 2.2bn, far beyond ~500 paintings. */
export function newPublicId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * Hebrew-safe slugify. Keeps Hebrew letters and ASCII alphanumerics, drops
 * niqqud and punctuation, collapses whitespace to hyphens. Hebrew in a URL is
 * percent-encoded on the wire but renders readably in the address bar.
 */
export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // niqqud & cantillation
    .replace(/["'׳״]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function paintingSlug(publicId: string, title: string): string {
  const tail = slugifyTitle(title);
  return tail ? `${publicId}-${tail}` : publicId;
}

/**
 * The id is everything before the first hyphen. Safe even though Hebrew titles
 * may contain hyphens, because the id is always leading base36.
 */
export function publicIdFromSlug(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* malformed percent-escape: the leading id is still readable as-is */
  }
  return s.split("-", 1)[0]!.toLowerCase();
}

export function paintingHref(publicId: string, title: string): string {
  return `/painting/${paintingSlug(publicId, title)}`;
}
