import { fallbackUrl, srcSet } from "./imageUrls";
import type { CardPainting } from "./queries";
import { paintingHref } from "./slug";
import { thumbhashDataUrl } from "./thumb";

/**
 * Everything a card needs to render, precomputed on the server.
 *
 * The search page renders cards on the client, so the card component itself must
 * be free of node-only code (sharp, Buffer). Mapping here keeps that boundary
 * clean and means the search API can ship ready-to-render rows.
 */
export type CardView = {
  publicId: string;
  title: string;
  year: number | null;
  medium: string | null;
  href: string;
  avif: string | null;
  webp: string | null;
  fallback: string | null;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  ratio: number;
};

export function toCardView(p: CardPainting): CardView {
  const hash = p.derivedHash;
  const iw = p.imgWidth ?? null;

  return {
    publicId: p.publicId,
    title: p.title,
    year: p.year,
    medium: p.medium,
    href: paintingHref(p.publicId, p.title),
    avif: hash && iw ? srcSet(hash, iw, "avif") : null,
    webp: hash && iw ? srcSet(hash, iw, "webp") : null,
    fallback: hash ? fallbackUrl(hash) : null,
    placeholder: thumbhashDataUrl(p.thumbhash),
    width: iw,
    height: p.imgHeight ?? null,
    // Before an image exists, fall back to the recorded canvas proportions so
    // the masonry keeps honest shapes for seeded/processing rows.
    ratio: p.widthCm && p.heightCm ? p.heightCm / p.widthCm : 1,
  };
}
