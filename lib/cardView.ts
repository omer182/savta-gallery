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

/*
 * A guard, not a design choice. Paintings really are sometimes long and narrow,
 * and the mosaic is built to show that — a tall tile is the point. This only
 * catches corrupt dimensions, which would otherwise produce a tile many screens
 * tall and a column of dead space beside it.
 */
const MIN_RATIO = 0.2;
const MAX_RATIO = 5;

export function toCardView(p: CardPainting): CardView {
  const hash = p.derivedHash;
  const iw = p.imgWidth ?? null;

  /*
   * height / width.
   *
   * The PROCESSED IMAGE wins: the mosaic reserves a tile from this ratio while
   * the image inside is laid out from the same number, so if the two ever
   * disagree the tiles collide. Canvas centimetres are only a fallback for rows
   * whose image has not been processed yet, and 1:1 the last resort.
   */
  const raw =
    p.imgWidth && p.imgHeight
      ? p.imgHeight / p.imgWidth
      : p.widthCm && p.heightCm
        ? p.heightCm / p.widthCm
        : 1;
  const ratio = Number.isFinite(raw) ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)) : 1;

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
    /*
     * Derived from `ratio`, not copied from the row. BlurImage sizes its box
     * from height/width when both are present, so this is what keeps the image
     * box and the tile the mosaic reserved for it in exact agreement. For any
     * sane row it is the stored height unchanged.
     */
    height: iw ? Math.round(iw * ratio) : (p.imgHeight ?? null),
    ratio,
  };
}
