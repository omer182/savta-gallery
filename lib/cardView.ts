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
    /*
     * height / width.
     *
     * The PROCESSED IMAGE wins: the mosaic sizes a tile from this ratio while
     * the image itself is laid out from its own pixel dimensions, so if the two
     * disagree the row heights go ragged. Canvas centimetres are only a
     * fallback for rows whose image has not been processed yet, and 1:1 the
     * last resort.
     */
    ratio:
      p.imgWidth && p.imgHeight
        ? p.imgHeight / p.imgWidth
        : p.widthCm && p.heightCm
          ? p.heightCm / p.widthCm
          : 1,
  };
}
